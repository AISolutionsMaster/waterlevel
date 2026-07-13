const fs = require('fs');
const path = require('path');

// 1. Read CRON_SECRET from local env file
let cronSecret = '';
try {
  const envLocalPath = path.join(__dirname, '../.env.local');
  const envPath = path.join(__dirname, '../.env');
  const targetPath = fs.existsSync(envLocalPath) ? envLocalPath : envPath;
  
  if (fs.existsSync(targetPath)) {
    const envContent = fs.readFileSync(targetPath, 'utf8');
    const match = envContent.match(/CRON_SECRET\s*=\s*([^\r\n]+)/);
    if (match) {
      cronSecret = match[1].trim().replace(/['"]/g, ''); // strip optional quotes
    }
  }
} catch (e) {
  console.log("Không thể đọc tệp cấu hình môi trường (.env).");
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log("==================================================");
  console.log("   ĐỒNG BỘ DỮ LIỆU THỰC TẾ HỒ CHỨA TỪ 30/06/2026   ");
  console.log("==================================================");
  console.log(`CRON_SECRET: ${cronSecret ? 'Đã tải thành công' : 'Chưa thiết lập (chạy chế độ không bảo mật)'}`);
  console.log("Yêu cầu: Dev server 'npm run dev' phải đang hoạt động tại http://localhost:3000\n");

  let loop = true;
  let batchCount = 1;

  while (loop) {
    console.log(`👉 Đang đồng bộ lô dữ liệu thứ ${batchCount}...`);
    try {
      const url = `http://localhost:3000/api/cron/scrape?key=${encodeURIComponent(cronSecret)}`;
      const res = await fetch(url);

      if (!res.ok) {
        const errText = await res.text();
        console.error(`❌ Thất bại (HTTP ${res.status}):`, errText);
        break;
      }

      const result = await res.json();
      console.log(`   - Số giờ đã cào: ${result.processedHours}`);
      console.log(`   - Bản ghi lưu mới/cập nhật: ${result.insertedRows}`);

      if (result.processedHours === 0 || result.processedHours === undefined || result.insertedRows === 0) {
        console.log("\n🎉 HOÀN THÀNH! Cơ sở dữ liệu đã được cập nhật đầy đủ dữ liệu thực tế từ ngày 30/06 đến nay.");
        loop = false;
      } else {
        batchCount++;
        console.log("⏳ Đang nghỉ 1.5 giây để tránh quá tải máy chủ EVN...");
        await sleep(1500);
      }
    } catch (err) {
      console.error("\n❌ Lỗi kết nối: Vui lòng kiểm tra lệnh 'npm run dev' xem Next.js dev server có đang chạy không.", err.message);
      break;
    }
  }
}

main();
