// utils/sync.js
const http = require('http');

console.log("=== ĐANG KHỞI CHẠY BỘ ĐỒNG BỘ DỮ LIỆU THỦY VĂN (LOCAL TO NEON) ===");

// Configuration
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/cron/scrape',
  method: 'GET',
  headers: {
    'Accept': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    console.log(`\n✅ Trạng thái phản hồi: ${res.statusCode}`);
    try {
      const parsed = JSON.parse(body);
      console.log("📊 Kết quả đồng bộ từ Local lên Neon DB:");
      console.log(`   - Số giờ được quét: ${parsed.processedHours || 0}`);
      console.log(`   - Số dòng dữ liệu đã ghi: ${parsed.insertedRows || 0}`);
      if (parsed.errors && parsed.errors.length > 0) {
        console.warn(`⚠️ Lỗi xảy ra (${parsed.errors.length}):`, parsed.errors);
      }
    } catch (e) {
      console.log("📝 Nội dung phản hồi:", body);
    }
  });
});

req.on('error', (e) => {
  console.error(`\n❌ Lỗi kết nối đến máy chủ local: ${e.message}`);
  console.error("💡 Hãy chắc chắn rằng bạn đang chạy lệnh 'npm run dev' trên máy tính cá nhân!");
});

req.end();
