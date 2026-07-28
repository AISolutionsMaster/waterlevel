import { NextResponse } from 'next/server';
import { getDb, initDatabaseSchema } from '../../../utils/db';
import { reservoirsMetadata, getActiveSeasonAndTransition } from '../../../data/reservoirs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Upstream reservoir mapping and travel delays (in hours)
const CASCADE_UPSTREAM: Record<string, { parent: string; delay: number }> = {
  'Sơn La': { parent: 'Lai Châu', delay: 6 },
  'Hòa Bình': { parent: 'Sơn La', delay: 12 }
};

// Gate configurations for discrete spillway operations
const GATE_CAPACITIES: Record<string, { deep: number; surface: number; maxDeep: number; maxSurface: number }> = {
  'Hòa Bình': { deep: 1600, surface: 1000, maxDeep: 12, maxSurface: 6 },
  'Sơn La': { deep: 1700, surface: 1000, maxDeep: 6, maxSurface: 4 },
  'Lai Châu': { deep: 1700, surface: 1000, maxDeep: 2, maxSurface: 3 },
  'Tuyên Quang': { deep: 1500, surface: 1000, maxDeep: 4, maxSurface: 2 },
  'Bản Vẽ': { deep: 1200, surface: 800, maxDeep: 2, maxSurface: 2 }
};

// Recursive function to simulate a reservoir and return forecast points
async function getSimulation(
  name: string,
  scenario: string,
  range: string,
  durationHours: number,
  visited: Set<string> = new Set()
): Promise<any[]> {
  // Prevent infinite loops just in case
  if (visited.has(name)) return [];
  visited.add(name);

  // 1. Fetch latest telemetry state
  let latestState: any = null;
  const sql = getDb();
  if (sql) {
    try {
      const records = await sql`
        SELECT timestamp, htl, qve, q_x, qxt, qxm, ncxs, ncxm
        FROM water_level_history
        WHERE reservoir_name = ${name}
        ORDER BY timestamp DESC
        LIMIT 1
      `;
      if (records.length > 0) {
        latestState = {
          timestamp: records[0].timestamp,
          htl: Number(records[0].htl),
          qve: Number(records[0].qve),
          q_x: Number(records[0].q_x),
          qxt: Number(records[0].qxt),
          qxm: Number(records[0].qxm),
          ncxs: Number(records[0].ncxs || 0),
          ncxm: Number(records[0].ncxm || 0),
        };
      }
    } catch (dbError) {
      console.error(`Forecast Simulation: DB error for ${name}:`, dbError);
    }
  }

  if (!latestState) {
    try {
      const { readLocalJsonDb } = require('../../../utils/db');
      const localData = readLocalJsonDb();
      const filtered = localData
        .filter((r: any) => r.reservoir_name === name)
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      if (filtered.length > 0) {
        latestState = {
          timestamp: filtered[0].timestamp,
          htl: Number(filtered[0].htl),
          qve: Number(filtered[0].qve),
          q_x: Number(filtered[0].q_x),
          qxt: Number(filtered[0].qxt),
          qxm: Number(filtered[0].qxm),
          ncxs: Number(filtered[0].ncxs || 0),
          ncxm: Number(filtered[0].ncxm || 0),
        };
      }
    } catch (fileError) {
      console.error(`Forecast Simulation: File error for ${name}:`, fileError);
    }
  }

  const meta = reservoirsMetadata[name] || {
    name,
    riverBasin: 'Chưa phân loại',
    region: 'Khác',
    hdbt: 100.0,
    hc: 80.0,
    hMinOp: 80.0,
    wTotal: 500,
    wActive: 300,
    wDead: 200,
    volumeExponent: 1.5,
    seasons: []
  };

  const hdbt = meta.hdbt;
  const hc = meta.hc;
  const hMinOp = meta.hMinOp || hc;
  const wTotal = meta.wTotal || 500;
  const wActive = meta.wActive || 300;
  const wDead = meta.wDead || 200;
  const exponent = meta.volumeExponent || 1.5;

  if (!latestState) {
    latestState = {
      timestamp: new Date().toISOString(),
      htl: hc + (hdbt - hc) * 0.5,
      qve: 200,
      q_x: 180,
      qxt: 0,
      qxm: 180,
      ncxs: 0,
      ncxm: 0
    };
  }

  // Determine initial gate configurations based on actual telemetry
  const gateMeta = GATE_CAPACITIES[name] || { deep: 1000, surface: 500, maxDeep: 2, maxSurface: 2 };
  let openDeepGates = latestState.ncxs || 0;
  if (openDeepGates === 0 && latestState.qxt > 0) {
    openDeepGates = Math.min(gateMeta.maxDeep, Math.ceil(latestState.qxt / gateMeta.deep));
  }
  let openSurfaceGates = latestState.ncxm || 0;
  let lastGateChangeTime = -999; // allows immediate change

  // 2. Fetch parent reservoir forecast if this is a downstream cascade
  let parentForecast: any[] = [];
  const upstreamConfig = CASCADE_UPSTREAM[name];
  if (upstreamConfig) {
    let parentScenario = scenario;
    if (scenario === 'flood_sonla') {
      parentScenario = name === 'Sơn La' ? 'constant' : 'flood_sonla';
    } else if (scenario === 'flood_hoabinh') {
      parentScenario = 'constant';
    }
    parentForecast = await getSimulation(upstreamConfig.parent, parentScenario, range, durationHours, visited);
  }

  const forecastPoints: any[] = [];
  const startTimestamp = new Date(latestState.timestamp);
  
  let currentHtl = latestState.htl;
  let currentQve = latestState.qve;
  let currentQxm = latestState.qxm;
  let currentQxt = latestState.qxt;
  const initialHtl = currentHtl;

  const maxTurbineDischarge = Math.max(
    currentQxm,
    meta.installedCapacity 
      ? (meta.installedCapacity * 2.5) 
      : currentQxm * 1.5
  );

  const activeSeason = getActiveSeasonAndTransition(meta, startTimestamp).activePhase;
  const hControl = activeSeason ? activeSeason.hControl : hdbt;

  const getVolumeFromH = (h: number) => {
    const ratio = Math.max(0, Math.min(1, (h - hc) / (hdbt - hc)));
    return wDead + wActive * Math.pow(ratio, exponent);
  };

  const getHFromVolume = (v: number) => {
    if (v <= wDead) return hc;
    const ratio = Math.max(0, Math.min(1, (v - wDead) / wActive));
    return hc + (hdbt - hc) * Math.pow(ratio, 1 / exponent);
  };

  let currentVolume = getVolumeFromH(currentHtl);
  let previousVolume = currentVolume;

  // Compute baseline local inflow (excluding upstream inflow) at t0
  let parentInitialQx = 0;
  if (upstreamConfig && parentForecast.length > 0) {
    parentInitialQx = parentForecast[0] ? parentForecast[0].q_x : 0;
  }
  const initialLocalQve = Math.max(0, currentQve - parentInitialQx);

  for (let t = 1; t <= durationHours; t++) {
    const ptTime = new Date(startTimestamp.getTime() + t * 60 * 60 * 1000);
    previousVolume = currentVolume;

    // 3. Inflow Calculation
    let qveForecast = currentQve;

    // Local inflow spikes/decays depending on scenario
    let isLocalFlood = false;
    if (scenario === 'flood') {
      isLocalFlood = true;
    } else if (scenario === 'flood_sonla' && name === 'Sơn La') {
      isLocalFlood = true;
    } else if (scenario === 'flood_hoabinh' && name === 'Hòa Bình') {
      isLocalFlood = true;
    }

    let localQve = initialLocalQve;
    if (isLocalFlood) {
      const tPeak = Math.floor(durationHours / 3);
      if (t <= tPeak) {
        const peakVal = Math.max(initialLocalQve * 3.5, meta.installedCapacity ? meta.installedCapacity * 1.5 : 500);
        localQve = initialLocalQve + ((peakVal - initialLocalQve) * (t / tPeak));
      } else {
        const peakVal = Math.max(initialLocalQve * 3.5, meta.installedCapacity ? meta.installedCapacity * 1.5 : 500);
        const baseline = initialLocalQve * 1.5;
        localQve = baseline + (peakVal - baseline) * Math.exp(-(t - tPeak) / (durationHours / 2.5));
      }
    } else if (scenario === 'dry') {
      const baseline = Math.max(5, initialLocalQve * 0.15);
      localQve = baseline + (initialLocalQve - baseline) * Math.exp(-t / (durationHours / 6));
    }

    // Add upstream inflow with delay
    if (upstreamConfig && parentForecast.length > 0) {
      const delay = upstreamConfig.delay;
      let upstreamQx = parentInitialQx;
      if (t - delay >= 1) {
        const parentPt = parentForecast[t - delay - 1];
        upstreamQx = parentPt ? parentPt.q_x : parentInitialQx;
      }
      qveForecast = localQve + upstreamQx;
    } else {
      // Standalone reservoir or head reservoir (like Lai Châu)
      let isHeadFlood = scenario === 'flood';
      if (scenario === 'flood_sonla' && name === 'Sơn La') isHeadFlood = true;
      if (scenario === 'flood_hoabinh' && name === 'Hòa Bình') isHeadFlood = true;

      if (isHeadFlood) {
        const tPeak = Math.floor(durationHours / 3);
        if (t <= tPeak) {
          const peakVal = Math.max(currentQve * 3.5, meta.installedCapacity ? meta.installedCapacity * 2.5 : 1000);
          qveForecast = currentQve + ((peakVal - currentQve) * (t / tPeak));
        } else {
          const peakVal = Math.max(currentQve * 3.5, meta.installedCapacity ? meta.installedCapacity * 2.5 : 1000);
          const baseline = currentQve * 1.5;
          qveForecast = baseline + (peakVal - baseline) * Math.exp(-(t - tPeak) / (durationHours / 2.5));
        }
      } else if (scenario === 'dry') {
        const baseline = Math.max(10, currentQve * 0.15);
        qveForecast = baseline + (currentQve - baseline) * Math.exp(-t / (durationHours / 6));
      }
    }

    // 4. Outflow Calculation
    let qxmForecast = currentQxm;
    let qxtForecast = currentQxt;

    const buffer = 0.2;
    const isAnyFlood = ['flood', 'flood_sonla', 'flood_hoabinh'].includes(scenario);

    if (scenario === 'constant') {
      qxmForecast = currentQxm;
      qxtForecast = currentQxt;
      openDeepGates = latestState.ncxs || 0;
      openSurfaceGates = latestState.ncxm || 0;

      if (currentHtl <= hMinOp + 0.1) {
        qxmForecast = 0;
        qxtForecast = 0;
        openDeepGates = 0;
        openSurfaceGates = 0;
      }
    } else {
      if (currentHtl <= hMinOp + 0.1) {
        qxmForecast = 0;
        openDeepGates = 0;
        openSurfaceGates = 0;
      } else if (scenario === 'dry') {
        qxmForecast = Math.min(currentQxm, maxTurbineDischarge * 0.4);
        openDeepGates = 0;
        openSurfaceGates = 0;
      } else {
        qxmForecast = qveForecast > maxTurbineDischarge ? maxTurbineDischarge : Math.max(currentQxm, Math.min(qveForecast, maxTurbineDischarge));
      }

      if (scenario !== 'dry' && currentHtl > hMinOp + 0.1) {
        const triggerLimit = hControl + buffer;
        const rawQxtNeeded = Math.max(0, qveForecast - qxmForecast);

        let targetDeepGates = 0;
        const isApproachingHdbt = currentHtl >= hdbt - 1.5;
        const isMassiveInflow = rawQxtNeeded > 2000;

        if (currentHtl >= triggerLimit && (isApproachingHdbt || isMassiveInflow)) {
          // Additional gates needed beyond what's already open
          targetDeepGates = Math.min(gateMeta.maxDeep, Math.max(openDeepGates, Math.ceil(rawQxtNeeded / gateMeta.deep)));

          // FLOOD REGULATION / CUTTING (Chỉ lũ / Cắt lũ) logic for Sơn La and Hòa Bình:
          if (isAnyFlood && ['Sơn La', 'Hòa Bình'].includes(name) && currentHtl < hdbt - 0.2) {
            // Under flood cutting, cap maximum open gates at (initial + 1) or safe limit
            const maxAllowedGates = name === 'Sơn La' ? 1 : 2; 
            targetDeepGates = Math.min(targetDeepGates, Math.max(openDeepGates, maxAllowedGates));
          }
        }

        // Emergency override: if water level is extremely high, override caps and open immediately!
        if (meta.hMaxTechnical && currentHtl >= meta.hMaxTechnical - 0.5) {
          targetDeepGates = gateMeta.maxDeep;
        }

        // Discrete gate switching rules with hysteresis
        const isEmergency = currentHtl >= hdbt - 0.2 || (meta.hMaxTechnical && currentHtl >= meta.hMaxTechnical - 0.5);
        const hoursSinceLastChange = t - lastGateChangeTime;

        if (targetDeepGates !== openDeepGates) {
          if (targetDeepGates > openDeepGates) {
            // OPENING GATES: Allowed every 6 hours, or immediately in emergency
            if (hoursSinceLastChange >= 6 || isEmergency) {
              if (isEmergency) {
                openDeepGates = targetDeepGates;
              } else {
                openDeepGates += 1;
              }
              lastGateChangeTime = t;
            }
          } else {
            // CLOSING GATES: Step-wise reduction as flood recedes back to 0
            // Closing conditions:
            // 1. It has been at least 12 hours since the last gate change.
            // 2. Inflow has receded so that remaining open gates + turbine can safely handle it.
            // 3. Water level is not rapidly rising.
            const isReceding = qveForecast < qxmForecast + Math.max(0, openDeepGates - 1) * gateMeta.deep + 500;

            if (hoursSinceLastChange >= 12 && isReceding) {
              openDeepGates = Math.max(0, openDeepGates - 1);
              lastGateChangeTime = t;
            }
          }
        }
      }

      qxtForecast = openDeepGates * gateMeta.deep;
    }

    const totalOutflow = qxmForecast + qxtForecast;

    const deltaV = (qveForecast - totalOutflow) * 3600 * 1e-6;
    currentVolume = Math.max(wDead * 0.98, Math.min(wTotal * 1.08, currentVolume + deltaV));
    currentHtl = getHFromVolume(currentVolume);

    forecastPoints.push({
      timestamp: ptTime.toISOString(),
      htl: parseFloat(currentHtl.toFixed(2)),
      qve: Math.round(qveForecast),
      q_x: Math.round(totalOutflow),
      qxt: Math.round(qxtForecast),
      qxm: Math.round(qxmForecast),
      ncxs: openDeepGates,
      ncxm: openSurfaceGates
    });
  }

  return forecastPoints;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('reservoir');
  const scenario = searchParams.get('scenario') || 'constant';
  const range = searchParams.get('range') || '3d';

  if (!name) {
    return NextResponse.json({ error: 'Reservoir name is required' }, { status: 400 });
  }

  let durationHours = 72;
  if (range === '7d') durationHours = 168;
  else if(range === '15d') durationHours = 360;
  else if (range === '30d') durationHours = 720;

  await initDatabaseSchema();

  try {
    const points = await getSimulation(name, scenario, range, durationHours);
    return NextResponse.json({
      success: true,
      reservoirName: name,
      scenario,
      range,
      data: points
    });
  } catch (error: any) {
    console.error(`Forecast API error for ${name}:`, error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Simulation failed'
    }, { status: 500 });
  }
}
