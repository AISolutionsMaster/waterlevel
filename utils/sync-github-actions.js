// utils/sync-github-actions.js
// Queries /api/latest-sync to find the last stored hour, then scrapes all missing hours
// from that point to now via a Vietnam proxy, and POSTs results to Vercel.
// Requires: npm install https-proxy-agent (installed by the GitHub Actions workflow step)
const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');

console.log("=== BỘ ĐỒNG BỘ CÀO DỮ LIỆU QUA PROXY VN (GITHUB ACTIONS TO VERCEL) ===");

const VERCEL_DOMAIN = "https://mucnuochothuydien.vercel.app";
const SCRAPE_PATH = "/api/cron/scrape";
const LATEST_SYNC_PATH = "/api/latest-sync";
// Safety cap: never scrape more than 48 hours back (prevents runaway on first deploy)
const MAX_HOURS_BACKFILL = 48;

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

// Fetch VN proxies from a single URL (returns plain ip:port list)
function fetchProxyListUrl(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchProxyListUrl(res.headers.location).then(resolve);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Parse either plain ip:port lines or JSON from GeoNode
        const proxies = [];
        try {
          const json = JSON.parse(data);
          // GeoNode format: { data: [{ ip, port }, ...] }
          if (Array.isArray(json.data)) {
            for (const p of json.data) {
              if (p.ip && p.port) proxies.push(`${p.ip}:${p.port}`);
            }
          }
        } catch {
          // Plain text format: one ip:port per line
          data.split(/\r?\n/).forEach(line => {
            const p = line.trim();
            if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(p)) proxies.push(p);
          });
        }
        resolve(proxies);
      });
    }).on('error', () => resolve([]));
  });
}

// Fetch VN proxies from multiple sources in parallel and deduplicate
async function getVietnamProxies() {
  console.log("📡 Đang lấy danh sách proxy Việt Nam từ nhiều nguồn...");

  const sources = [
    // ProxyScrape — relax anonymity filter to get more results
    'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=VN&ssl=all&anonymity=all',
    // ProxyScrape v3 — separate endpoint, different pool
    'https://api.proxyscrape.com/v3/free-proxy-list/get?request=displayproxies&protocol=http&timeout=10000&country=VN',
    // GeoNode — JSON API, large pool
    'https://proxylist.geonode.com/api/proxy-list?limit=100&page=1&sort_by=lastChecked&sort_type=desc&country=VN&protocols=http',
  ];

  const results = await Promise.all(sources.map(fetchProxyListUrl));
  // Flatten and deduplicate
  const seen = new Set();
  const proxies = [];
  for (const list of results) {
    for (const p of list) {
      if (!seen.has(p)) { seen.add(p); proxies.push(p); }
    }
  }

  console.log(`✅ Tổng cộng ${proxies.length} proxy Việt Nam (từ ${results.map((r, i) => `nguồn ${i+1}: ${r.length}`).join(', ')}).`);
  return proxies;
}


// Fetch EVN page through a Vietnam proxy using https-proxy-agent (handles CONNECT tunnel reliably)
function fetchPageWithProxy(targetDate, proxy, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const pathQuery = `/PageHoChuaThuyDienEmbedEVN.aspx?td=${encodeURIComponent(formatEvnDate(targetDate))}`;
    const agent = new HttpsProxyAgent(`http://${proxy}`);

    const req = https.request({
      hostname: 'hochuathuydien.evn.com.vn',
      port: 443,
      path: pathQuery,
      method: 'GET',
      agent,
      timeout: timeoutMs,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'vi-VN,vi;q=0.9',
      }
    }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) { req.destroy(); return resolve(null); }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(body.includes('<tbody>') ? body : null));
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}


// Test proxies in parallel batches of 15 to find a working one fast
async function findWorkingProxyFast(proxies) {
  console.log(`🔎 Kiểm tra ${proxies.length} proxy song song (nhóm 15, timeout 4s)...`);
  const batchSize = 15;
  const targetDate = new Date();
  for (let i = 0; i < proxies.length; i += batchSize) {
    const batch = proxies.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (proxy) => {
        const html = await fetchPageWithProxy(targetDate, proxy, 4000);
        return html ? proxy : null;
      })
    );
    const found = results.find(Boolean);
    if (found) return found;
  }
  return null;
}

// Generic HTTPS GET → returns parsed JSON or null on error
function httpsGetJson(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

// Query Vercel for the latest stored timestamp in the DB
async function getLatestSyncedTimestamp(secretKey) {
  const url = `${VERCEL_DOMAIN}${LATEST_SYNC_PATH}${secretKey ? `?key=${encodeURIComponent(secretKey)}` : ''}`;
  console.log('🔍 Đang truy vấn timestamp mới nhất từ Vercel...');
  const json = await httpsGetJson(url);
  if (json && json.latestTimestamp) {
    const ts = new Date(json.latestTimestamp);
    console.log(`📅 Dữ liệu mới nhất trong DB: ${ts.toISOString()}`);
    return ts;
  }
  console.warn('⚠️  Không lấy được timestamp — sẽ bắt đầu từ 48 giờ trước.');
  return null;
}

// POST scraped records to Vercel using built-in https (no fetch/npm needed)
function postToVercel(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(responseData) }); }
        catch { resolve({ status: res.statusCode, body: responseData }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const secretKey = process.env.CRON_SECRET || "";

  // 1. Query Vercel for the latest stored timestamp to find gaps
  const latestStored = await getLatestSyncedTimestamp(secretKey);

  // 2. Build list of missing hours: from (latestStored + 1h) up to current hour
  const currentHour = new Date();
  currentHour.setUTCMinutes(0, 0, 0);

  const earliestAllowed = new Date(currentHour.getTime() - MAX_HOURS_BACKFILL * 60 * 60 * 1000);
  const fromHour = latestStored
    ? new Date(Math.max(latestStored.getTime() + 60 * 60 * 1000, earliestAllowed.getTime()))
    : earliestAllowed;

  // Floor fromHour to the hour boundary
  fromHour.setUTCMinutes(0, 0, 0);

  const hoursToScrape = [];
  for (let t = new Date(fromHour); t <= currentHour; t = new Date(t.getTime() + 60 * 60 * 1000)) {
    hoursToScrape.push(new Date(t));
  }

  if (hoursToScrape.length === 0) {
    console.log('✅ Dữ liệu đã đầy đủ — không có giờ nào bị thiếu.');
    process.exit(0);
  }

  console.log(`🕒 Cần cào ${hoursToScrape.length} giờ: từ ${formatEvnDate(hoursToScrape[0])} → ${formatEvnDate(hoursToScrape[hoursToScrape.length - 1])}`);

  // 3. Get Vietnam proxies
  const proxies = await getVietnamProxies();
  if (proxies.length === 0) {
    console.error('❌ Không lấy được danh sách proxy. Dừng.');
    process.exit(1);
  }

  // 4. Find a working proxy
  const workingProxy = await findWorkingProxyFast(proxies);
  if (!workingProxy) {
    console.error('❌ Không tìm thấy proxy Việt Nam nào hoạt động. Vui lòng chạy lại sau.');
    process.exit(1);
  }
  console.log(`✨ Kết nối thành công qua proxy: ${workingProxy}`);

  // 5. Scrape each missing hour sequentially
  const allRecords = [];
  for (const hour of hoursToScrape) {
    console.log(`   -> Quét giờ: ${formatEvnDate(hour)}...`);
    const html = await fetchPageWithProxy(hour, workingProxy);
    if (!html) {
      console.warn(`      ⚠️  Không tải được HTML — bỏ qua giờ này.`);
      continue;
    }
    const parsed = parseEvnHtml(html, hour.getUTCFullYear(), hour.getUTCMonth() + 1, hour.toISOString());
    if (parsed && parsed.length > 0) {
      allRecords.push(...parsed);
      console.log(`      └─ OK: ${parsed.length} dòng.`);
    } else {
      console.warn(`      ⚠️  HTML hợp lệ nhưng không có dữ liệu.`);
    }
    // Small delay to avoid hammering the proxy
    if (hoursToScrape.length > 1) await new Promise(r => setTimeout(r, 300));
  }

  if (allRecords.length === 0) {
    console.error('❌ Không thu thập được dữ liệu nào từ EVN. Dừng.');
    process.exit(1);
  }

  // 6. POST all records to Vercel in one request
  const targetUrl = `${VERCEL_DOMAIN}${SCRAPE_PATH}${secretKey ? `?key=${encodeURIComponent(secretKey)}` : ''}`;
  console.log(`\n📤 Đang gửi ${allRecords.length} dòng lên Vercel...`);

  try {
    const result = await postToVercel(targetUrl, { records: allRecords });
    if (result.status < 200 || result.status >= 300) {
      console.error(`❌ Lỗi HTTP ${result.status}:`, result.body);
      process.exit(1);
    }
    console.log(`🎉 THÀNH CÔNG: Đã ghi ${result.body.insertedRows ?? allRecords.length} dòng lên Vercel Postgres!`);
    process.exit(0); // Force exit — open proxy sockets would otherwise keep Node.js alive
  } catch (err) {
    console.error('❌ Lỗi mạng khi gửi dữ liệu:', err.message);
    process.exit(1);
  }
}

main();
