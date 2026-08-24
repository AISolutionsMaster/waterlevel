import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Giám sát Mực nước Hồ Thủy điện Việt Nam',
    short_name: 'Mực Nước Thủy Điện',
    description: 'Hệ thống theo dõi thời gian thực vận hành hồ chứa, mực nước lũ, lưu lượng xả và cảnh báo an toàn thiên tai các hồ thủy điện tại Việt Nam.',
    start_url: '/',
    display: 'standalone',
    background_color: '#090d16',
    theme_color: '#0284c7',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
