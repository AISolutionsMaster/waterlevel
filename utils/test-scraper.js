async function testHistoricalScrape() {
  const dates = [
    '10/07/2026 09:00',
    '11/07/2026 09:00',
    '12/07/2026 09:00',
    '13/07/2026 09:00'
  ];

  console.log('=== ĐANG TRUY XUẤT DỮ LIỆU THỰC TẾ HỒ HÒA BÌNH TỪ EVN ===\n');

  for (const dateStr of dates) {
    const url = `https://hochuathuydien.evn.com.vn/PageHoChuaThuyDienEmbedEVN.aspx?td=${encodeURIComponent(dateStr)}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      
      const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
      if (!tbodyMatch) continue;
      
      const tbody = tbodyMatch[1];
      const rowRegex = /<tr>([\s\S]*?)<\/tr>/gi;
      let match;
      let found = false;
      
      while ((match = rowRegex.exec(tbody)) !== null) {
        const rowHtml = match[1];
        const nameMatch = rowHtml.match(/<b>([^<]+)<\/b>/i);
        if (nameMatch && nameMatch[1].includes('Hòa Bình')) {
          const tdRegex = /<td[^>]*class='tdclass'[^>]*>([\s\S]*?)<\/td>/gi;
          const tdMatches = [...rowHtml.matchAll(tdRegex)];
          if (tdMatches.length >= 10) {
            const values = tdMatches.map(m => m[1].replace(/&nbsp;/g, "").trim());
            console.log(`📅 Thời điểm: ${dateStr}`);
            console.log(`   - Nước thượng lưu (Htl): ${values[1]} m`);
            console.log(`   - Lưu lượng về (Qve): ${values[4]} m³/s`);
            console.log(`   - Tổng lượng xả (Qxả): ${values[5]} m³/s`);
            console.log(`   - Xả qua tràn (Qxt): ${values[6]} m³/s`);
            console.log(`   - Số cửa xả sâu mở: ${values[8]}`);
            console.log('--------------------------------------------------');
            found = true;
            break;
          }
        }
      }
      if (!found) {
        console.log(`📅 Thời điểm: ${dateStr} - Không tìm thấy dữ liệu hồ Hòa Bình trên EVN.`);
      }
    } catch (e) {
      console.error(`Lỗi khi lấy dữ liệu ngày ${dateStr}:`, e.message);
    }
  }
}

testHistoricalScrape();
