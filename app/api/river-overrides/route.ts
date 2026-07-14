import { NextResponse } from 'next/server';
import { saveRiverOverride } from '../../../utils/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { stationName, level } = body;

    if (!stationName) {
      return NextResponse.json({ success: false, error: 'Missing stationName' }, { status: 400 });
    }

    // level can be null/undefined to clear override
    const parsedLevel = (level === null || level === undefined || level === '') ? null : Number(level);

    if (parsedLevel !== null && isNaN(parsedLevel)) {
      return NextResponse.json({ success: false, error: 'Invalid level value' }, { status: 400 });
    }

    await saveRiverOverride(stationName, parsedLevel);

    return NextResponse.json({ success: true, stationName, level: parsedLevel });
  } catch (e: any) {
    console.error("Failed to save river level override:", e);
    return NextResponse.json({ success: false, error: e.message || 'Internal server error' }, { status: 500 });
  }
}
