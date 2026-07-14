import { NextResponse } from 'next/server';
import { getDb, initDatabaseSchema } from '../../../../utils/db';
import { fetchWaterLevels } from '../../../../utils/scraper';

export const maxDuration = 60; // Extend serverless timeout to 60s for backfilling support
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  return handleScrape(request);
}

export async function POST(request: Request) {
  return handleScrape(request);
}

async function handleScrape(request: Request) {
  // 1. Authorization Check (for Vercel Cron or webhook triggers)
  const authHeader = request.headers.get('authorization');
  const { searchParams } = new URL(request.url);
  const bypassKey = searchParams.get('key');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const isAuthorized = 
      authHeader === `Bearer ${cronSecret}` || 
      bypassKey === cronSecret;
      
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // 2. Initialize Database & Get connection
  await initDatabaseSchema();
  const sql = getDb();
  if (!sql) {
    // === Fallback to local JSON Database when running locally without Neon ===
    console.log("No PostgreSQL connected. Performing hourly scraping and storing in local JSON file.");
    try {
      const { readLocalJsonDb, writeLocalJsonDb } = require('../../../../utils/db');
      const startTime = Date.now();
      const maxExecutionTime = 50000; // 50s locally
      
      const localData = readLocalJsonDb();
      const existingSet = new Set(localData.map((r: any) => new Date(r.timestamp).getTime()));
      
      const now = new Date();
      const currentHour = new Date(now);
      currentHour.setMinutes(0, 0, 0);

      const startHour = new Date(2026, 5, 30, 0, 0, 0); // June 30, 2026
      const missingHours: Date[] = [];
      let checkTime = new Date(startHour);

      while (checkTime.getTime() <= currentHour.getTime()) {
        if (!existingSet.has(checkTime.getTime())) {
          missingHours.push(new Date(checkTime));
        }
        checkTime.setTime(checkTime.getTime() + 60 * 60 * 1000);
      }

      missingHours.sort((a, b) => a.getTime() - b.getTime());

      console.log(`Scraper (JSON Mode) triggered. Total missing hours found since June 30: ${missingHours.length}`);

      let insertedCount = 0;
      const fetchErrors: string[] = [];
      const processedHours: string[] = [];

      for (const hour of missingHours) {
        if (Date.now() - startTime > maxExecutionTime) {
          console.warn(`Approaching execution limit (${maxExecutionTime}ms). Stopping batch and saving progress.`);
          break;
        }

        processedHours.push(hour.toISOString());

        try {
          const records = await fetchWaterLevels(hour);
          
          if (records.length === 0) {
            // Placeholder record
            const exists = localData.some((r: any) => r.reservoir_name === 'SYSTEM_PLACEHOLDER' && new Date(r.timestamp).getTime() === hour.getTime());
            if (!exists) {
              localData.push({
                reservoir_name: 'SYSTEM_PLACEHOLDER',
                timestamp: hour.toISOString(),
                htl: -1,
                hdbt: 0,
                hc: 0,
                qve: 0,
                q_x: 0,
                qxt: 0,
                qxm: 0,
                ncxs: 0,
                ncxm: 0,
                sync_time: 'No data on EVN'
              });
              insertedCount++;
            }
            continue;
          }

          for (const r of records) {
            // Upsert: check if duplicate exists
            const idx = localData.findIndex((item: any) => item.reservoir_name === r.name && new Date(item.timestamp).getTime() === r.parsedTimestamp.getTime());
            
            const dbRecord = {
              reservoir_name: r.name,
              timestamp: r.parsedTimestamp.toISOString(),
              htl: r.htl,
              hdbt: r.hdbt,
              hc: r.hc,
              qve: r.qve,
              q_x: r.q_x,
              qxt: r.qxt,
              qxm: r.qxm,
              ncxs: r.ncxs,
              ncxm: r.ncxm,
              sync_time: r.syncTimeText
            };

            if (idx >= 0) {
              localData[idx] = dbRecord;
            } else {
              localData.push(dbRecord);
            }
            insertedCount++;
          }
        } catch (e: any) {
          console.error(`Failed to scrape/save JSON data for hour ${hour.toISOString()}:`, e);
          fetchErrors.push(`${hour.toISOString()}: ${e.message || e}`);
        }
      }

      // Cleanup records older than 30 days
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const cleanedData = localData.filter((r: any) => new Date(r.timestamp).getTime() >= thirtyDaysAgo);
      writeLocalJsonDb(cleanedData);

      return NextResponse.json({
        success: true,
        mode: 'local_json_file',
        processedHours: processedHours.length,
        insertedRows: insertedCount,
        errors: fetchErrors.length > 0 ? fetchErrors : undefined
      });

    } catch (err: any) {
      console.error("Local JSON scraper failure:", err);
      return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
    }
  }

  try {
    const startTime = Date.now();
    const maxExecutionTime = process.env.VERCEL ? 8000 : 50000; // 8s on Vercel, 50s locally

    // 3. Find all existing timestamps since June 30, 2026 (including placeholders)
    const existingResult = await sql`
      SELECT DISTINCT timestamp FROM water_level_history 
      WHERE timestamp >= '2026-06-30 00:00:00'
    `;
    const existingSet = new Set(
      existingResult.map((r: any) => new Date(r.timestamp).getTime())
    );

    const now = new Date();
    const currentHour = new Date(now);
    currentHour.setMinutes(0, 0, 0); // Floor to current hour

    // Generate list of missing hours from June 30, 2026 to currentHour
    const startHour = new Date(2026, 5, 30, 0, 0, 0); // June 30, 2026
    const missingHours: Date[] = [];
    let checkTime = new Date(startHour);

    while (checkTime.getTime() <= currentHour.getTime()) {
      if (!existingSet.has(checkTime.getTime())) {
        missingHours.push(new Date(checkTime));
      }
      checkTime.setTime(checkTime.getTime() + 60 * 60 * 1000);
    }

    // Sort missing hours chronologically (oldest first)
    missingHours.sort((a, b) => a.getTime() - b.getTime());

    console.log(`Scraper triggered. Total missing hours found since June 30: ${missingHours.length}`);

    let insertedCount = 0;
    const fetchErrors: string[] = [];
    const processedHours: string[] = [];

    // 4. Fetch and insert data for each target hour, respecting execution time limit
    for (const hour of missingHours) {
      // Check if we are approaching execution limit
      if (Date.now() - startTime > maxExecutionTime) {
        console.warn(`Approaching execution limit (${maxExecutionTime}ms). Stopping batch and saving progress.`);
        break;
      }

      processedHours.push(hour.toISOString());

      try {
        const records = await fetchWaterLevels(hour);
        
        if (records.length === 0) {
          // If EVN returns no data for this hour, insert a placeholder record to prevent re-checking it forever
          await sql`
            INSERT INTO water_level_history (
              reservoir_name, timestamp, htl, hdbt, hc, qve, q_x, qxt, qxm, ncxs, ncxm, sync_time
            ) VALUES (
              'SYSTEM_PLACEHOLDER', ${hour}, -1, 0, 0, 0, 0, 0, 0, 0, 0, 'No data on EVN'
            )
            ON CONFLICT (reservoir_name, timestamp) DO NOTHING
          `;
          continue;
        }

        // Insert records
        for (const r of records) {
          await sql`
            INSERT INTO water_level_history (
              reservoir_name, timestamp, htl, hdbt, hc, qve, q_x, qxt, qxm, ncxs, ncxm, sync_time
            ) VALUES (
              ${r.name}, ${r.parsedTimestamp}, ${r.htl}, ${r.hdbt}, ${r.hc}, ${r.qve}, ${r.q_x}, ${r.qxt}, ${r.qxm}, ${r.ncxs}, ${r.ncxm}, ${r.syncTimeText}
            )
            ON CONFLICT (reservoir_name, timestamp) 
            DO UPDATE SET
              htl = EXCLUDED.htl,
              qve = EXCLUDED.qve,
              q_x = EXCLUDED.q_x,
              qxt = EXCLUDED.qxt,
              qxm = EXCLUDED.qxm,
              ncxs = EXCLUDED.ncxs,
              ncxm = EXCLUDED.ncxm,
              sync_time = EXCLUDED.sync_time
          `;
          insertedCount++;
        }
      } catch (e: any) {
        console.error(`Failed to scrape/save data for hour ${hour.toISOString()}:`, e);
        fetchErrors.push(`${hour.toISOString()}: ${e.message || e}`);
      }
    }

    // 5. Database Cleanup: Delete records older than 30 days to stay well within free Neon storage limits
    try {
      const deleteResult = await sql`
        DELETE FROM water_level_history 
        WHERE timestamp < NOW() - INTERVAL '30 days'
      `;
      console.log(`Cleaned up old records.`);
    } catch (cleanupError) {
      console.error("Database cleanup warning:", cleanupError);
    }

    return NextResponse.json({
      success: true,
      processedHours: processedHours.length,
      insertedRows: insertedCount,
      errors: fetchErrors.length > 0 ? fetchErrors : undefined
    });

  } catch (error: any) {
    console.error("General scraper route failure:", error);
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
  }
}
