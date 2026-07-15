// utils/sync-production-standalone.js
const fs = require('fs');
const path = require('path');

console.log("=== BỘ ĐỒNG BỘ TỰ ĐỘNG THỦY VĂN ĐỘC LẬP (LOCAL STANDALONE TO PRODUCTION) ===");

// Configuration
const VERCEL_DOMAIN = "https://mucnuochothuydien.vercel.app";
const API_PATH = "/api/cron/scrape";

// Parse EVN Date exactly as Next.js scraper does
function formatEvnDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, '0');
  return `${day}/${month}/${year} ${hour}:00`;
}

// Clean names and html helpers
function cleanName(rawName) {
  return rawName.replace(/<\/?[^>]+(>|$)/g, "").trim();
}

// Parse EVN Embed Page HTML
function parseEvnHtml(html, queryYear, queryMonth, timestampIso) {
  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) {
    throw new Error("Không thể tìm thấy thẻ <tbody> trong trang HTML của EVN");
  }
  
  const tbody = tbodyMatch[1];
  const rowRegex = /<tr>([\s\S]*?)<\/tr>/gi;
  const regionRegex = /<td[^>]*colspan='11'[^>]*><strong>([^<]+)<\/strong>/i;
  
  const records = [];
  let currentRegion = "Khác";
  let match;
  
  while ((match = rowRegex.exec(tbody)) !== null) {
    const rowHtml = match[1];
    
    // Check if it is a Region header row
    const regionMatch = rowHtml.match(regionRegex);
    if (regionMatch) {
      currentRegion = regionMatch[1].trim() || "Khác";
      continue;
    }

    // Check if it is a Data row (contains reservoir name in bold <b>)
    const nameMatch = rowHtml.match(/<b>([^<]+)<\/b>/i);
    if (nameMatch) {
      const rawName = nameMatch[1].trim();
      const name = cleanName(rawName);
      
      const syncMatch = rowHtml.match(/Đồng bộ lúc:\s*([^<]+)/i);
      const syncTimeText = syncMatch ? syncMatch[1].trim() : "";

      const tdRegex = /<td[^>]*class='tdclass'[^>]*>([\s\S]*?)<\/td>/gi;
      const tdMatches = [...rowHtml.matchAll(tdRegex)];
      
      if (tdMatches.length >= 10) {
        const values = tdMatches.map(m => m[1].replace(/&nbsp;/g, "").trim());
        
        const htl = parseFloat(values[1]) || 0;
        const hdbt = parseFloat(values[2]) || 0;
        const hc = parseFloat(values[3]) || 0;
        const qve = parseFloat(values[4]) || 0;
        const q_x = parseFloat(values[5]) || 0;
        const qxt = parseFloat(values[6]) || 0;
        const qxm = parseFloat(values[7]) || 0;
        const ncxs = parseInt(values[8]) || 0;
        const ncxm = parseInt(values[9]) || 0;

        records.push({
          reservoir_name: name,
          timestamp: timestampIso,
          htl,
          hdbt,
          hc,
          qve,
          q_x,
          qxt,
          qxm,
          ncxs,
          ncxm,
          sync_time: syncTimeText
        });
      }
    }
  }
  return records;
}

// Scrape one hour
async function scrapeHour(targetDate) {
  let url = 'https://hochuathuydien.evn.com.vn/PageHoChuaThuyDienEmbedEVN.aspx';
  if (targetDate) {
    const formattedDate = formatEvnDate(targetDate);
    url += `?td=${encodeURIComponent(formattedDate)}`;
  }
  
  const queryYear = targetDate ? targetDate.getFullYear() : new Date().getFullYear();
  const queryMonth = targetDate ? targetDate.getMonth() + 1 : new Date().getMonth() + 1;

  // Align parsedTimestamp to hourly bounds
  const parsedTimestamp = new Date(targetDate || new Date());
  parsedTimestamp.setMinutes(0, 0, 0);
  parsedTimestamp.setSeconds(0, 0);
  const timestampIso = parsedTimestamp.toISOString();

  console.log(`🔍 Đang tải dữ liệu EVN cho thời điểm: ${formatEvnDate(parsedTimestamp)}...`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout for local crawl

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Phản hồi lỗi HTTP ${response.status}`);
    }

    const html = await response.text();
    const parsed = parseEvnHtml(html, queryYear, queryMonth, timestampIso);
    console.log(`   └─ Tìm thấy ${parsed.length} dòng dữ liệu.`);
    return parsed;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`   ❌ Lỗi khi tải dữ liệu từ ${url}:`, error.message);
    return [];
  }
}

// Main execution block
async function main() {
  const secretKey = process.argv[2] || "";
  
  // Calculate target times for the last 6 hours to backfill any potential gaps
  const hoursToScrape = 6;
  let allRecords = [];
  
  console.log(`🕒 Quét bù dữ liệu của ${hoursToScrape} giờ vừa qua để tránh mất dữ liệu khi máy tắt/ngủ...`);
  
  for (let i = hoursToScrape - 1; i >= 0; i--) {
    const targetDate = new Date();
    targetDate.setHours(targetDate.getHours() - i);
    
    const records = await scrapeHour(targetDate);
    allRecords = allRecords.concat(records);
    
    // Quick delay between requests to be polite to EVN server
    await new Promise(r => setTimeout(r, 500));
  }

  if (allRecords.length === 0) {
    console.log("❌ Không thu thập được dữ liệu nào từ EVN. Dừng tiến trình.");
    process.exit(1);
  }

  console.log(`\n📤 Chuẩn bị gửi ${allRecords.length} dòng dữ liệu lên Production Vercel...`);
  
  // POST to Vercel
  const targetUrl = `${VERCEL_DOMAIN}${API_PATH}${secretKey ? `?key=${encodeURIComponent(secretKey)}` : ""}`;
  
  const batchSize = 100;
  let totalInserted = 0;
  
  for (let i = 0; i < allRecords.length; i += batchSize) {
    const batch = allRecords.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(allRecords.length / batchSize);
    
    console.log(`🚀 Đang tải lên lô ${batchNum}/${totalBatches} (${batch.length} dòng)...`);
    
    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(secretKey ? { 'Authorization': `Bearer ${secretKey}` } : {})
        },
        body: JSON.stringify({ records: batch }),
        keepalive: true
      });
      
      if (!response.ok) {
        const text = await response.text();
        console.error(`   ❌ Lỗi tải lên: HTTP ${response.status} - ${text}`);
        if (response.status === 401) {
          console.log("   💡 Sai mã bảo mật CRON_SECRET. Hãy kiểm tra lại Key.");
        }
        process.exit(1);
      }
      
      const resJson = await response.json();
      totalInserted += (resJson.insertedRows || 0);
      console.log(`   └─ Đã ghi thêm thành công: ${resJson.insertedRows || 0} dòng.`);
    } catch (err) {
      console.error(`   ❌ Lỗi kết nối mạng khi gửi dữ liệu: ${err.message}`);
      process.exit(1);
    }
  }

  console.log(`\n🎉 HOÀN THÀNH ĐỒNG BỘ: Đã đồng bộ thành công ${totalInserted} dòng mới lên Postgres!`);
}

main();
