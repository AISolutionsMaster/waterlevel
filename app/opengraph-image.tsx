import { ImageResponse } from 'next/og';

export const alt = 'Hệ thống Giám sát Mực nước Hồ Chứa Thủy điện Việt Nam';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 80px',
          background: 'linear-gradient(135deg, #090d16 0%, #0c1829 45%, #0f2744 100%)',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
        }}
      >
        {/* Glow accent */}
        <div
          style={{
            position: 'absolute',
            top: '-80px',
            right: '-80px',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(14, 165, 233, 0.25) 0%, rgba(0, 0, 0, 0) 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-100px',
            left: '150px',
            width: '450px',
            height: '450px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, rgba(0, 0, 0, 0) 70%)',
          }}
        />

        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'rgba(14, 165, 233, 0.15)',
              border: '1px solid rgba(14, 165, 233, 0.4)',
              padding: '8px 18px',
              borderRadius: '999px',
            }}
          >
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#10b981',
              }}
            />
            <span
              style={{
                color: '#38bdf8',
                fontSize: '15px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              HỆ THỐNG GIÁM SÁT THỜI GIAN THỰC
            </span>
          </div>

          <div
            style={{
              color: '#94a3b8',
              fontSize: '16px',
              fontWeight: 500,
            }}
          >
            mucnuochothuydien.vercel.app
          </div>
        </div>

        {/* Main Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
          <h1
            style={{
              fontSize: '56px',
              fontWeight: 900,
              lineHeight: 1.15,
              margin: 0,
              background: 'linear-gradient(90deg, #ffffff 0%, #bae6fd 60%, #38bdf8 100%)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Mực Nước Hồ Thủy Điện
          </h1>
          <p
            style={{
              fontSize: '22px',
              color: '#94a3b8',
              lineHeight: 1.4,
              margin: 0,
              maxWidth: '960px',
            }}
          >
            Theo dõi mực nước thượng lưu, lưu lượng nước về, xả lũ qua tràn & cảnh báo đón lũ an toàn trên toàn quốc
          </p>
        </div>

        {/* Highlights / Badges Bar */}
        <div
          style={{
            display: 'flex',
            gap: '20px',
            marginTop: '20px',
          }}
        >
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              padding: '16px 20px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
            }}
          >
            <span style={{ fontSize: '13px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Phạm vi giám sát</span>
            <span style={{ fontSize: '24px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>80+ Hồ chứa EVN</span>
          </div>

          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              padding: '16px 20px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
            }}
          >
            <span style={{ fontSize: '13px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Tính năng</span>
            <span style={{ fontSize: '24px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>Dự báo & Cắt lũ</span>
          </div>

          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              padding: '16px 20px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
            }}
          >
            <span style={{ fontSize: '13px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Cập nhật</span>
            <span style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b', marginTop: '4px' }}>Tự động liên tục</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
