import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

// Singleton instance helper for database client
let sqlInstance: any = null;

export function getDb() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.warn("DATABASE_URL is not set. Database operations will be mocked or fall back.");
    return null;
  }
  
  if (!sqlInstance) {
    sqlInstance = neon(dbUrl);
  }
  return sqlInstance;
}

/**
 * Initializes the database schema, creating tables and constraints.
 */
export async function initDatabaseSchema() {
  const sql = getDb();
  if (!sql) return false;

  try {
    // Create water_level_history table
    await sql`
      CREATE TABLE IF NOT EXISTS water_level_history (
        id SERIAL PRIMARY KEY,
        reservoir_name VARCHAR(100) NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL,
        htl NUMERIC,
        hdbt NUMERIC,
        hc NUMERIC,
        qve NUMERIC,
        q_x NUMERIC,
        qxt NUMERIC,
        qxm NUMERIC,
        ncxs INTEGER,
        ncxm INTEGER,
        sync_time VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_reservoir_time UNIQUE (reservoir_name, timestamp)
      )
    `;

    // Ensure index exists for performance
    await sql`
      CREATE INDEX IF NOT EXISTS idx_reservoir_time 
      ON water_level_history (reservoir_name, timestamp DESC)
    `;

    console.log("Database schema initialized successfully.");
    return true;
  } catch (error) {
    console.error("Failed to initialize database schema:", error);
    return false;
  }
}

export interface DbRecord {
  reservoir_name: string;
  timestamp: string; // ISO string
  htl: number;
  hdbt: number;
  hc: number;
  qve: number;
  q_x: number;
  qxt: number;
  qxm: number;
  ncxs: number;
  ncxm: number;
  sync_time: string;
}

const localDbPath = path.join(process.cwd(), 'data/history-store.json');

export function readLocalJsonDb(): DbRecord[] {
  try {
    if (!fs.existsSync(localDbPath)) {
      return [];
    }
    const data = fs.readFileSync(localDbPath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error("Failed to read local JSON DB:", e);
    return [];
  }
}

export function writeLocalJsonDb(records: DbRecord[]): void {
  try {
    const dir = path.dirname(localDbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(localDbPath, JSON.stringify(records, null, 2), 'utf8');
  } catch (e) {
    console.error("Failed to write local JSON DB:", e);
  }
}

const overridesPath = path.join(process.cwd(), 'data/river-overrides.json');

export function readLocalOverrides(): Record<string, number> {
  try {
    if (!fs.existsSync(overridesPath)) {
      return {};
    }
    const data = fs.readFileSync(overridesPath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error("Failed to read local overrides:", e);
    return {};
  }
}

export function writeLocalOverrides(overrides: Record<string, number>): void {
  try {
    const dir = path.dirname(overridesPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(overridesPath, JSON.stringify(overrides, null, 2), 'utf8');
  } catch (e) {
    console.error("Failed to write local overrides:", e);
  }
}

export async function initOverridesSchema() {
  const sql = getDb();
  if (!sql) return false;

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS river_level_overrides (
        station_name VARCHAR(100) PRIMARY KEY,
        override_level NUMERIC,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `;
    return true;
  } catch (error) {
    console.error("Failed to initialize overrides schema:", error);
    return false;
  }
}

export async function getRiverOverrides(): Promise<Record<string, number>> {
  const sql = getDb();
  if (sql) {
    try {
      await initOverridesSchema();
      const rows = await sql`
        SELECT station_name, override_level 
        FROM river_level_overrides
      `;
      const result: Record<string, number> = {};
      for (const row of rows) {
        if (row.override_level !== null && row.override_level !== undefined) {
          result[row.station_name] = Number(row.override_level);
        }
      }
      return result;
    } catch (e) {
      console.error("Failed to fetch overrides from Postgres, falling back to local:", e);
    }
  }
  return readLocalOverrides();
}

export async function saveRiverOverride(stationName: string, level: number | null): Promise<void> {
  const sql = getDb();
  if (sql) {
    try {
      await initOverridesSchema();
      if (level === null) {
        await sql`
          DELETE FROM river_level_overrides 
          WHERE station_name = ${stationName}
        `;
      } else {
        await sql`
          INSERT INTO river_level_overrides (station_name, override_level, updated_at)
          VALUES (${stationName}, ${level}, CURRENT_TIMESTAMP)
          ON CONFLICT (station_name) 
          DO UPDATE SET override_level = ${level}, updated_at = CURRENT_TIMESTAMP
        `;
      }
      return;
    } catch (e) {
      console.error("Failed to save override to Postgres, falling back to local:", e);
    }
  }
  
  const local = readLocalOverrides();
  if (level === null) {
    delete local[stationName];
  } else {
    local[stationName] = level;
  }
  writeLocalOverrides(local);
}

