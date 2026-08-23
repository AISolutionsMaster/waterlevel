// utils/sync-github-actions.js
// Lightweight GitHub Actions sync script — no npm dependencies, uses only Node.js built-ins.
// Queries /api/latest-sync to find the last stored hour, then scrapes all missing hours
// from that point to now via a Vietnam proxy, and POSTs results to Vercel.
const https = require('https');

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

// Fetch list of active Vietnam proxies — uses built-in https (no npm needed)
function getVietnamProxies() {
  return new Promise((resolve) => {
    const url = 'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=5000&country=VN&ssl=all&anonymity=all';
    console.log("📡 Đang lấy danh sách proxy Việt Nam...");
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const proxies = data.split('\r\n').map(p => p.trim()).filter(Boolean);
        console.log(`✅ Tìm thấy ${proxies.length} proxy Việt Nam.`);
        resolve(proxies);
      });
    }).on('error', (err) => {
      console.warn("⚠️ Không thể lấy danh sách proxy:", err.message);
      resolve([]);
    });
  });
}

// Fetch EVN page via HTTP CONNECT tunnel through a Vietnam proxy — no npm needed (net + tls built-ins)
function fetchPageWithProxy(targetDate, proxy, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const [proxyHost, proxyPort] = proxy.split(':');
    const pathQuery = `/PageHoChuaThuyDienEmbedEVN.aspx?td=${encodeURIComponent(formatEvnDate(targetDate))}`;

    // Open TCP connection to the proxy and send HTTP CONNECT to tunnel to EVN
    const net = require('net');
    const socket = net.createConnection({ host: proxyHost, port: parseInt(proxyPort) }, () => {
      socket.write(`CONNECT hochuathuydien.evn.com.vn:443 HTTP/1.1\r\nHost: hochuathuydien.evn.com.vn:443\r\n\r\n`);
    });

    let tunnelEstablished = false;
    let buffer = '';

    const timer = setTimeout(() => { socket.destroy(); resolve(null); }, timeoutMs);

    socket.on('data', (chunk) => {
      if (!tunnelEstablished) {
        buffer += chunk.toString();
        if (buffer.includes('200')) {
          // Tunnel open — upgrade to TLS and send the HTTPS request
          tunnelEstablished = true;
          const tlsSocket = require('tls').connect({
            socket,
            servername: 'hochuathuydien.evn.com.vn',
            rejectUnauthorized: false
          }, () => {
            tlsSocket.write(
              `GET ${pathQuery} HTTP/1.1\r\n` +
              `Host: hochuathuydien.evn.com.vn\r\n` +
              `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\n` +
              `Accept-Language: vi-VN,vi;q=0.9\r\n` +
              `Connection: close\r\n\r\n`
            );
          });

          let responseBuffer = Buffer.alloc(0);
          tlsSocket.on('data', (d) => { responseBuffer = Buffer.concat([responseBuffer, d]); });
          tlsSocket.on('end', () => {
            clearTimeout(timer);
            const text = responseBuffer.toString('utf8');
            // Strip HTTP response headers, keep HTML body
            const bodyStart = text.indexOf('\r\n\r\n');
            const body = bodyStart >= 0 ? text.slice(bodyStart + 4) : text;
            resolve(body.includes('<tbody>') ? body : null);
          });
          tlsSocket.on('error', () => { clearTimeout(timer); resolve(null); });
        } else if (/^HTTP\/\d\.\d [45]/.test(buffer)) {
          clearTimeout(timer); socket.destroy(); resolve(null);
        }
      }
    });

    socket.on('error', () => { clearTimeout(timer); resolve(null); });
    socket.on('timeout', () => { clearTimeout(timer); socket.destroy(); resolve(null); });
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
  } catch (err) {
    console.error('❌ Lỗi mạng khi gửi dữ liệu:', err.message);
    process.exit(1);
  }
}

main();
