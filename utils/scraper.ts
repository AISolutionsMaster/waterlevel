import { reservoirsMetadata, getActiveSeasonAndTransition } from '../data/reservoirs';

export interface ScrapeRecord {
  name: string;
  region: string;
  syncTimeText: string;
  time: string;
  htl: number;
  hdbt: number;
  hc: number;
  hMinOp: number;
  hControl: number;
  qve: number;
  q_x: number;
  qxt: number;
  qxm: number;
  ncxs: number;
  ncxm: number;
  parsedTimestamp: Date;
}

/**
 * Formats a Date object to EVN's query format: DD/MM/YYYY HH:mm
 */
export function formatEvnDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, '0');
  return `${day}/${month}/${year} ${hour}:00`;
}

/**
 * Fetches water level data from EVN for a specific hour, or the latest available if no date is provided.
 */
export async function fetchWaterLevels(targetDate?: Date): Promise<ScrapeRecord[]> {
  let url = 'https://hochuathuydien.evn.com.vn/PageHoChuaThuyDienEmbedEVN.aspx';
  
  if (targetDate) {
    const formattedDate = formatEvnDate(targetDate);
    url += `?td=${encodeURIComponent(formattedDate)}`;
  }

  const queryYear = targetDate ? targetDate.getFullYear() : new Date().getFullYear();
  const queryMonth = targetDate ? targetDate.getMonth() + 1 : new Date().getMonth() + 1;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      next: { revalidate: 60 } // Cache for 1 minute on edge
    });

    if (!response.ok) {
      throw new Error(`EVN site responded with status ${response.status}`);
    }

    const html = await response.text();
    return parseEvnHtml(html, queryYear, queryMonth, targetDate || new Date());
  } catch (error) {
    console.error(`Failed to scrape EVN water levels from ${url}:`, error);
    throw error;
  }
}

/**
 * Parses the raw HTML from EVN embed page.
 */
export function parseEvnHtml(html: string, queryYear: number, queryMonth: number, systemDate: Date): ScrapeRecord[] {
  // Extract tbody content containing all table rows
  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) {
    throw new Error("Could not find table body (<tbody>) in EVN page HTML");
  }
  
  const tbody = tbodyMatch[1];
  
  const rowRegex = /<tr>([\s\S]*?)<\/tr>/gi;
  const regionRegex = /<td[^>]*colspan='11'[^>]*><strong>([^<]+)<\/strong>/i;
  
  const records: ScrapeRecord[] = [];
  let currentRegion = "Khác";

  let match;
  while ((match = rowRegex.exec(tbody)) !== null) {
    const rowHtml = match[1];
    
    // 1. Check if it is a Region header row
    const regionMatch = rowHtml.match(regionRegex);
    if (regionMatch) {
      currentRegion = regionMatch[1].trim() || "Khác";
      continue;
    }

    // 2. Check if it is a Data row (contains reservoir name in bold <b>)
    const nameMatch = rowHtml.match(/<b>([^<]+)<\/b>/i);
    if (nameMatch) {
      const rawName = nameMatch[1].trim();
      
      // Clean name in case it contains extra tags
      const name = rawName.replace(/<\/?[^>]+(>|$)/g, "");
      
      // Extract sync time if reported
      const syncMatch = rowHtml.match(/Đồng bộ lúc:\s*([^<]+)/i);
      const syncTimeText = syncMatch ? syncMatch[1].trim() : "";

      // Extract all columns
      const tdRegex = /<td[^>]*class='tdclass'[^>]*>([\s\S]*?)<\/td>/gi;
      const tdMatches = [...rowHtml.matchAll(tdRegex)];
      
      if (tdMatches.length >= 10) {
        const values = tdMatches.map(m => m[1].replace(/&nbsp;/g, "").trim());
        
        const timeStr = values[0]; // e.g. "10/07 13:00"
        const htl = parseFloat(values[1]) || 0;
        const hdbt = parseFloat(values[2]) || 0;
        const hc = parseFloat(values[3]) || 0;
        const qve = parseFloat(values[4]) || 0;
        const q_x = parseFloat(values[5]) || 0;
        const qxt = parseFloat(values[6]) || 0;
        const qxm = parseFloat(values[7]) || 0;
        const ncxs = parseInt(values[8]) || 0;
        const ncxm = parseInt(values[9]) || 0;

        // Floor to the hour using the query systemDate to align with the crawler's exact hourly bounds (preventing minute mismatch loops)
        const parsedTimestamp = new Date(systemDate);
        parsedTimestamp.setMinutes(0, 0, 0);

        // Retrieve static reservoir metadata if configured, otherwise fallback to scraped defaults
        const meta = reservoirsMetadata[name] || {
          name,
          riverBasin: "Chưa phân loại",
          region: currentRegion,
          hdbt: hdbt || htl,
          hc: hc,
          hMinOp: hc,
          seasons: []
        };

        // Resolve active control level for this reservoir at systemDate
        const { activePhase } = getActiveSeasonAndTransition(meta, systemDate);
        const hControl = activePhase ? activePhase.hControl : meta.hdbt;

        records.push({
          name,
          region: meta.region || currentRegion,
          syncTimeText,
          time: timeStr,
          htl,
          hdbt: meta.hdbt || hdbt,
          hc: meta.hc || hc,
          hMinOp: meta.hMinOp,
          hControl,
          qve,
          q_x,
          qxt,
          qxm,
          ncxs,
          ncxm,
          parsedTimestamp
        });
      }
    }
  }

  return records;
}
