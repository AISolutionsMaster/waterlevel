import { NextResponse } from 'next/server';
import { getDb, initDatabaseSchema, getRiverOverrides } from '../../../utils/db';
import { fetchWaterLevels } from '../../../utils/scraper';
import { reservoirsMetadata, getActiveSeasonAndTransition, estimateHydroPower } from '../../../data/reservoirs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  await initDatabaseSchema();
  const sql = getDb();

  let latestData: any[] = [];
  let isFromDb = false;

  // 1. Try to fetch from Neon Postgres database
  if (sql) {
    try {
      // DISTINCT ON retrieves the single latest record for each reservoir
      latestData = await sql`
        SELECT DISTINCT ON (reservoir_name) 
          reservoir_name as name, 
          timestamp, 
          htl, 
          hdbt, 
          hc, 
          qve, 
          q_x, 
          qxt, 
          qxm, 
          ncxs, 
          ncxm, 
          sync_time
        FROM water_level_history
        ORDER BY reservoir_name, timestamp DESC
      `;
      isFromDb = latestData.length > 0;
    } catch (dbError) {
      console.error("Database query failed, falling back to direct scraping:", dbError);
    }
  }

  // 1b. Fallback to local JSON Database if sql is not configured
  if (!isFromDb) {
    try {
      const { readLocalJsonDb } = require('../../../utils/db');
      const localData = readLocalJsonDb();
      if (localData.length > 0) {
        const groups: Record<string, any> = {};
        for (const r of localData) {
          if (r.reservoir_name === 'SYSTEM_PLACEHOLDER') continue;
          const rTime = new Date(r.timestamp).getTime();
          if (!groups[r.reservoir_name] || rTime > new Date(groups[r.reservoir_name].timestamp).getTime()) {
            groups[r.reservoir_name] = {
              name: r.reservoir_name,
              timestamp: r.timestamp,
              htl: Number(r.htl),
              hdbt: Number(r.hdbt),
              hc: Number(r.hc),
              qve: Number(r.qve),
              q_x: Number(r.q_x),
              qxt: Number(r.qxt),
              qxm: Number(r.qxm),
              ncxs: Number(r.ncxs),
              ncxm: Number(r.ncxm),
              sync_time: r.sync_time
            };
          }
        }
        latestData = Object.values(groups);
        isFromDb = latestData.length > 0;
      }
    } catch (fileError) {
      console.error("Local JSON database load failed:", fileError);
    }
  }

  // 2. Fallback to direct scraping if DB is empty or unreachable
  if (latestData.length === 0) {
    try {
      console.log("No DB data. Scraped live water levels directly.");
      const scraped = await fetchWaterLevels();
      latestData = scraped.map(r => ({
        name: r.name,
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
      }));
    } catch (scrapeError) {
      console.error("Direct scraping fallback failed:", scrapeError);
      return NextResponse.json({ error: "Failed to load water level data" }, { status: 500 });
    }
  }

  // 3. Enrich the records with our metadata, seasonal alerts, and transition warnings
  const enrichedData = latestData.map(item => {
    // Explicitly parse string numeric types from Postgres to JS Numbers
    const htl = Number(item.htl) || 0;
    const hdbt = Number(item.hdbt) || 0;
    const hc = Number(item.hc) || 0;
    const qve = Number(item.qve) || 0;
    const q_x = Number(item.q_x) || 0;
    const qxt = Number(item.qxt) || 0;
    const qxm = Number(item.qxm) || 0;
    const ncxs = Number(item.ncxs) || 0;
    const ncxm = Number(item.ncxm) || 0;

    const meta = reservoirsMetadata[item.name] || {
      name: item.name,
      riverBasin: "Chưa phân loại",
      region: item.region || "Khác",
      hdbt: hdbt,
      hc: hc,
      hMinOp: hc,
      seasons: []
    };

    const recordDate = new Date(item.timestamp);
    const { activePhase, daysToTransition, nextPhase } = getActiveSeasonAndTransition(meta, new Date());
    
    // Safety thresholds
    const hControl = activePhase ? activePhase.hControl : meta.hdbt;
    const isExceeded = htl >= hControl;
    const isUpcomingWarning = !isExceeded && (hControl - htl <= 0.5); // 0.5m warning window
    const isCậnDeadLevel = htl <= meta.hMinOp;

    let status: "normal" | "warning" | "danger" | "dead" = "normal";
    if (isCậnDeadLevel) status = "dead";
    else if (isExceeded) status = "danger";
    else if (isUpcomingWarning) status = "warning";

    const powerGen = estimateHydroPower(
      htl,
      qxm,
      meta.tailraceElev,
      meta.installedCapacity
    );

    return {
      ...item,
      htl,
      hdbt,
      hc,
      qve,
      q_x,
      qxt,
      qxm,
      ncxs,
      ncxm,
      riverBasin: meta.riverBasin,
      region: meta.region || item.region || "Khác",
      hMinOp: meta.hMinOp,
      hControl,
      status,
      activeSeasonName: activePhase ? activePhase.name : "N/A",
      transitionAlert: daysToTransition <= 7 ? {
        daysRemaining: daysToTransition,
        nextSeasonName: nextPhase?.name || "",
        nextHControl: nextPhase?.hControl || 0,
        currentHControl: hControl
      } : null,
      installedCapacity: meta.installedCapacity || null,
      tailraceElev: meta.tailraceElev || null,
      estimatedPowerMW: powerGen.powerMW,
      estimatedEnergyKwh: powerGen.energyKwh,
      wTotal: meta.wTotal || null,
      wActive: meta.wActive || null,
      wDead: meta.wDead || null,
      wFlood: meta.wFlood || null,
      volumeExponent: meta.volumeExponent || 2.0,
      hMaxTechnical: meta.hMaxTechnical || null,
      emergencyBreachNotes: meta.emergencyBreachNotes || null
    };
  });

  // 4. Self-healing background trigger check
  let hasGaps = false;
  
  if (sql) {
    try {
      const countResult = await sql`
        SELECT COUNT(DISTINCT timestamp) as cnt FROM water_level_history 
        WHERE timestamp >= '2026-06-30 00:00:00'
      `;
      const dbCount = Number(countResult[0]?.cnt || 0);
      
      const startHour = new Date(2026, 5, 30, 0, 0, 0);
      const currentHour = new Date();
      currentHour.setMinutes(0, 0, 0);
      const totalHoursExpected = Math.floor((currentHour.getTime() - startHour.getTime()) / (60 * 60 * 1000)) + 1;
      
      if (dbCount < totalHoursExpected) {
        hasGaps = true;
      }
    } catch (countErr) {
      console.error("Failed to query unique hours count:", countErr);
    }
  } else {
    try {
      const { readLocalJsonDb } = require('../../../utils/db');
      const localData = readLocalJsonDb();
      const uniqueCount = new Set(localData.map((r: any) => r.timestamp)).size;
      
      const startHour = new Date(2026, 5, 30, 0, 0, 0);
      const currentHour = new Date();
      currentHour.setMinutes(0, 0, 0);
      const totalHoursExpected = Math.floor((currentHour.getTime() - startHour.getTime()) / (60 * 60 * 1000)) + 1;
      
      if (uniqueCount < totalHoursExpected) {
        hasGaps = true;
      }
    } catch (fileErr) {
      console.error("Failed to check local JSON DB count:", fileErr);
    }
  }

  const latestTime = latestData.length > 0 ? new Date(latestData[0].timestamp).getTime() : 0;
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const isStale = latestTime < oneHourAgo;

  if (isStale || hasGaps || latestData.length === 0) {
    console.log(`Self-healing background scraper triggered. Stale: ${isStale}, Has Gaps: ${hasGaps}, Empty: ${latestData.length === 0}. Dispatching background scrape/backfill...`);
    try {
      const { protocol, host } = new URL(request.url);
      const cronUrl = `${protocol}//${host}/api/cron/scrape`;
      
      // Dispatch background promise
      fetch(cronUrl, {
        cache: 'no-store',
        headers: process.env.CRON_SECRET ? { 'Authorization': `Bearer ${process.env.CRON_SECRET}` } : {}
      }).catch(err => console.error("Stale background scrape trigger warning:", err));
    } catch (e) {
      console.error("Failed to dispatch background scrape:", e);
    }
  }

  const overrides = await getRiverOverrides();

  return NextResponse.json({
    success: true,
    isFromDb,
    isStale,
    latestTimestamp: latestData.length > 0 ? latestData[0].timestamp : null,
    data: enrichedData,
    overrides
  });
}
