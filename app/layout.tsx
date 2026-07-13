import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Giám sát Mực nước các Hồ Thủy điện Việt Nam",
  description: "Hệ thống theo dõi thời gian thực vận hành hồ chứa, mực nước lũ, lưu lượng xả và cảnh báo an toàn thiên tai các hồ thủy điện tại Việt Nam.",
  keywords: ["thủy điện", "mực nước hồ chứa", "lưu lượng xả", "cảnh báo đón lũ", "EVN", "vận hành liên hồ chứa"],
  authors: [{ name: "Antigravity" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
