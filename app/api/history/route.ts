import { NextResponse } from 'next/server';
import { getDb, initDatabaseSchema } from '../../../utils/db';
import { reservoirsMetadata } from '../../../data/reservoirs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('reservoir');
  const currentValStr = searchParams.get('current');
  const currentVal = currentValStr ? parseFloat(currentValStr) : null;
  const range = searchParams.get('range') || '3d';

  if (!name) {
    return NextResponse.json({ error: 'Reservoir name is required' }, { status: 400 });
  }

  // Calculate threshold date based on range
  let days = 3;
  if (range === '7d') days = 7;
  else if (range === '15d') days = 15;
  else if (range === '30d') days = 30;
  else if (range === '1y') days = 365;

  const thresholdDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  await initDatabaseSchema();
  const sql = getDb();

  let history: any[] = [];
  let isFromDb = false;

  // 1. Fetch from Neon Postgres if configured
  if (sql) {
    try {
      history = await sql`
        SELECT 
          timestamp, 
          htl, 
          qve, 
          q_x, 
          qxt, 
          qxm
        FROM water_level_history
        WHERE reservoir_name = ${name}
          AND timestamp >= ${thresholdDate.toISOString()}
        ORDER BY timestamp ASC
      `;
      isFromDb = history.length > 0;
    } catch (dbError) {
      console.error(`Failed to fetch history for ${name} from DB:`, dbError);
    }
  }

  // 1b. Fetch from local JSON file if sql is not configured or returned no data
  if (history.length === 0) {
    try {
      const { readLocalJsonDb } = require('../../../utils/db');
      const localData = readLocalJsonDb();
      const thresholdTime = thresholdDate.getTime();
      
      const filtered = localData.filter((r: any) => 
        r.reservoir_name === name && 
        new Date(r.timestamp).getTime() >= thresholdTime
      );

      if (filtered.length > 0) {
        history = filtered.map((r: any) => ({
          timestamp: r.timestamp,
          htl: Number(r.htl),
          qve: Number(r.qve),
          q_x: Number(r.q_x),
          qxt: Number(r.qxt),
          qxm: Number(r.qxm)
        }));
        // Sort ascending
        history.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        isFromDb = true; // Mark as real data (retrieved from local file storage)
      }
    } catch (fileError) {
      console.error(`Failed to fetch history for ${name} from local file:`, fileError);
    }
  }

  // 2. Fallback to mock data if DB has no history, ensuring chart renders beautifully in dev
  if (history.length === 0) {
    const meta = reservoirsMetadata[name] || { hdbt: 100, hc: 80 };
    const hRange = meta.hdbt - meta.hc;
    const baseHtl = currentVal !== null ? currentVal : (meta.hc + hRange * 0.45);

    const now = Date.now();
    const mockHours = 24; // Return 24 hours of mock logs

    for (let i = mockHours; i >= 0; i--) {
      const timestamp = new Date(now - i * 60 * 60 * 1000);
      timestamp.setMinutes(0, 0, 0);

      // Add realistic sine-wave water level variations
      const sinOffset = Math.sin((i / mockHours) * Math.PI * 4) * (hRange * 0.05);
      const htl = parseFloat((baseHtl + sinOffset).toFixed(2));

      // Realistic flow variations
      const qve = Math.round(500 + Math.sin((i / mockHours) * Math.PI * 2) * 200 + Math.random() * 50);
      const q_x = Math.round(480 + Math.cos((i / mockHours) * Math.PI * 2) * 150 + Math.random() * 30);

      history.push({
        timestamp: timestamp.toISOString(),
        htl,
        qve,
        q_x,
        qxt: q_x > 400 ? q_x - 300 : 0,
        qxm: q_x > 400 ? 300 : q_x
      });
    }
  }

  return NextResponse.json({
    success: true,
    isFromDb,
    data: history
  });
}
