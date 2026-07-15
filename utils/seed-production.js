// utils/seed-production.js
const fs = require('fs');
const path = require('path');

console.log("=== BẮT ĐẦU ĐỒNG BỘ LỊCH SỬ DỮ LIỆU LÊN PRODUCTION (JSON TO POSTGRES) ===");

const localDbPath = path.join(__dirname, '../data/history-store.json');
if (!fs.existsSync(localDbPath)) {
  console.error("❌ Không tìm thấy tệp history-store.json tại đường dẫn:", localDbPath);
  process.exit(1);
}

// Read and parse
const data = fs.readFileSync(localDbPath, 'utf8');
let records = [];
try {
  records = JSON.parse(data).filter(r => r.reservoir_name !== 'SYSTEM_PLACEHOLDER');
} catch (e) {
  console.error("❌ Lỗi khi phân tích cú pháp tệp JSON:", e.message);
  process.exit(1);
}

console.log(`📝 Đã tải ${records.length} bản ghi lịch sử từ file cục bộ.`);

// Read custom secret if passed as argument
const secretKey = process.argv[2] || "";
const targetUrl = `https://mucnuochothuydien.vercel.app/api/cron/scrape${secretKey ? `?key=${encodeURIComponent(secretKey)}` : ""}`;

console.log(`🌐 Địa chỉ đích: ${targetUrl}`);

async function runSeeding() {
  const batchSize = 100;
  let totalInserted = 0;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(records.length / batchSize);
    
    console.log(`🚀 Đang gửi lô thứ ${batchNum}/${totalBatches} (${batch.length} dòng)...`);
    
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
        const errMsg = await response.text();
        console.error(`❌ Gửi lô thất bại: HTTP ${response.status} - ${errMsg}`);
        console.log("💡 Nếu bạn đã cấu hình CRON_SECRET trên Vercel, hãy chạy lại lệnh kèm Key: 'node utils/seed-production.js <YOUR_SECRET>'");
        process.exit(1);
      }
      
      const resData = await response.json();
      totalInserted += (resData.insertedRows || 0);
      console.log(`   └─ Thành công: Đã ghi ${resData.insertedRows || 0} dòng.`);
      
    } catch (err) {
      console.error(`❌ Lỗi kết nối mạng: ${err.message}`);
      process.exit(1);
    }
  }
  
  console.log(`\n🎉 HOÀN THÀNH: Đã đồng bộ tổng cộng ${totalInserted} dòng dữ liệu lên Production Postgres!`);
}

runSeeding();
