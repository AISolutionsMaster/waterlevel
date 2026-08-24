import { NextResponse } from 'next/server';
import { getDb, initDatabaseSchema } from '../../../utils/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/latest-sync
 * Returns the most recent timestamp stored in the water_level_history table.
 * Used by GitHub Actions to determine where to start scraping from.
 */
export async function GET(request: Request) {
  // Authorization check
  const { searchParams } = new URL(request.url);
  const bypassKey = searchParams.get('key');
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const isAuthorized =
      authHeader === `Bearer ${cronSecret}` ||
      bypassKey === cronSecret;
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  await initDatabaseSchema();
  const sql = getDb();

  if (!sql) {
    return NextResponse.json({ error: 'No database connection' }, { status: 503 });
  }

  try {
    const result = await sql`
      SELECT MAX(timestamp) AS latest_timestamp
      FROM water_level_history
      WHERE reservoir_name != 'SYSTEM_PLACEHOLDER'
    `;

    const latestTimestamp = result[0]?.latest_timestamp ?? null;

    return NextResponse.json({ latestTimestamp });
  } catch (err: any) {
    console.error('latest-sync error:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
