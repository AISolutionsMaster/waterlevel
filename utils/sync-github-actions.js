// utils/sync-github-actions.js
const fs = require('fs');
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');

console.log("=== BỘ ĐỒNG BỘ CÀO DỮ LIỆU QUA PROXY VN (GITHUB ACTIONS TO VERCEL) ===");

const VERCEL_DOMAIN = "https://mucnuochothuydien.vercel.app";
const API_PATH = "/api/cron/scrape";

function formatEvnDate(date) {
  const vnTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const day = String(vnTime.getUTCDate()).padStart(2, '0');
  const month = String(vnTime.getUTCMonth() + 1).padStart(2, '0');
  const year = vnTime.getUTCFullYear();
  const hour = String(vnTime.getUTCHours()).padStart(2, '0');
  return `${day}/${month}/${year} ${hour}:00`;
}

function cleanName(rawName) {
  return rawName.replace(/<\/?[^>]+(>|$)/g, "").trim();
}

function parseEvnHtml(html, queryYear, queryMonth, timestampIso) {
  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return null;
  
  const tbody = tbodyMatch[1];
  const rowRegex = /<tr>([\s\S]*?)<\/tr>/gi;
  const regionRegex = /<td[^>]*colspan='11'[^>]*><strong>([^<]+)<\/strong>/i;
  
  const records = [];
  let currentRegion = "Khác";
  let match;
  
  while ((match = rowRegex.exec(tbody)) !== null) {
    const rowHtml = match[1];
    const regionMatch = rowHtml.match(regionRegex);
    if (regionMatch) {
      currentRegion = regionMatch[1].trim() || "Khác";
      continue;
    }

    const nameMatch = rowHtml.match(/<b>([^<]+)<\/b>/i);
    if (nameMatch) {
      const name = cleanName(nameMatch[1]);
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

// Fetch list of active Vietnam proxies
async function getVietnamProxies() {
  const url = 'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=5000&country=VN&ssl=all&anonymity=all';
  console.log("📡 Đang lấy danh sách proxy Việt Nam hoạt động từ ProxyScrape...");
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn("⚠️ Không thể lấy danh sách proxy, sử dụng kết nối trực tiếp.");
      return [];
    }
    const text = await response.text();
    const proxies = text.split('\r\n').map(p => p.trim()).filter(Boolean);
    console.log(`✅ Đã tìm thấy ${proxies.length} proxy Việt Nam.`);
    return proxies;
  } catch (err) {
    console.error("❌ Lỗi khi lấy danh sách proxy:", err.message);
    return [];
  }
}

// Fetch EVN page using a specific proxy agent via native https module
function fetchPageWithProxy(targetDate, proxy, timeoutMs = 4000) {
  return new Promise((resolve) => {
    let pathQuery = '/PageHoChuaThuyDienEmbedEVN.aspx';
    if (targetDate) {
      pathQuery += `?td=${encodeURIComponent(formatEvnDate(targetDate))}`;
    }

    const https = require('https');
    try {
      const agent = new HttpsProxyAgent(`http://${proxy}`);
      
      const options = {
        hostname: 'hochuathuydien.evn.com.vn',
        port: 443,
        path: pathQuery,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        agent: agent,
        timeout: timeoutMs
      };

      const req = https.request(options, (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return resolve(null);
        }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve(body));
      });

      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });

      req.end();
    } catch (e) {
      resolve(null);
    }
  });
}

// Concurrently test proxies in batches of 10 to find a working one fast (< 4 seconds)
async function findWorkingProxyFast(proxies) {
  console.log(`🔎 Đang kiểm tra ${proxies.length} proxy song song theo nhóm 10 (timeout 3.5s)...`);
  const batchSize = 10;
  for (let i = 0; i < proxies.length; i += batchSize) {
    const batch = proxies.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (proxy) => {
        const html = await fetchPageWithProxy(new Date(), proxy, 3500);
        if (html && html.includes("<tbody>")) {
          return proxy;
        }
        return null;
      })
    );
    const found = results.find(Boolean);
    if (found) {
      return found;
    }
  }
  return null;
}

async function main() {
  const secretKey = process.env.CRON_SECRET || "";
  const proxies = await getVietnamProxies();
  
  const hoursToScrape = 6;
  let allRecords = [];
  
  // 1. Find a working proxy concurrently
  const workingProxy = await findWorkingProxyFast(proxies);

  if (!workingProxy) {
    console.error("❌ Không tìm thấy proxy Việt Nam nào hoạt động vào lúc này. Vui lòng chạy lại sau.");
    process.exit(1);
  }
  console.log(`✨ Kết nối thành công qua proxy: ${workingProxy}`);

  // 2. Fetch the last 6 hours of data using the working proxy
  console.log(`🕒 Tiến hành cào dữ liệu ${hoursToScrape} giờ gần nhất qua proxy: ${workingProxy}...`);
  for (let i = hoursToScrape - 1; i >= 0; i--) {
    const targetDate = new Date(Date.now() - i * 60 * 60 * 1000);
    
    // Align parsedTimestamp to hourly bounds in UTC
    const parsedTimestamp = new Date(targetDate);
    parsedTimestamp.setUTCMinutes(0, 0, 0);
    const timestampIso = parsedTimestamp.toISOString();

    console.log(`   -> Quét giờ: ${formatEvnDate(parsedTimestamp)}...`);
    const html = await fetchPageWithProxy(targetDate, workingProxy);
    if (html) {
      try {
        const queryYear = parsedTimestamp.getFullYear();
        const queryMonth = parsedTimestamp.getMonth() + 1;
        const parsed = parseEvnHtml(html, queryYear, queryMonth, timestampIso);
        if (parsed && parsed.length > 0) {
          allRecords = allRecords.concat(parsed);
          console.log(`      └─ OK: Đã đọc được ${parsed.length} dòng.`);
        }
      } catch (err) {
        console.warn(`      ⚠️ Lỗi phân tích cú pháp HTML: ${err.message}`);
      }
    } else {
      console.warn(`      ⚠️ Lỗi tải HTML cho thời điểm này.`);
    }
    
    await new Promise(r => setTimeout(r, 500));
  }

  if (allRecords.length === 0) {
    console.error("❌ Không thu thập được dữ liệu nào từ EVN. Dừng.");
    process.exit(1);
  }

  // 3. Upload to Vercel
  console.log(`\n📤 Đang gửi ${allRecords.length} dòng dữ liệu lên Production Vercel...`);
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
        body: JSON.stringify({ records: batch })
      });
      
      if (!response.ok) {
        const text = await response.text();
        console.error(`   ❌ Lỗi tải lên: HTTP ${response.status} - ${text}`);
        process.exit(1);
      }
      
      const resJson = await response.json();
      totalInserted += (resJson.insertedRows || 0);
      console.log(`   └─ Đã ghi thêm thành công: ${resJson.insertedRows || 0} dòng.`);
    } catch (err) {
      console.error(`   ❌ Lỗi mạng khi gửi dữ liệu lên Vercel: ${err.message}`);
      process.exit(1);
    }
  }

  console.log(`\n🎉 THÀNH CÔNG: Đã đồng bộ tổng cộng ${totalInserted} dòng mới từ GitHub Actions lên Vercel Postgres!`);
}

main();
