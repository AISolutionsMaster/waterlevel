import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mucnuochothuydien.vercel.app";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0284c7" },
    { media: "(prefers-color-scheme: dark)", color: "#090d16" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Giám sát Mực nước Hồ Thủy điện Việt Nam | Tra cứu Thời gian thực",
    template: "%s | Giám sát Mực nước Hồ Thủy điện",
  },
  description:
    "Hệ thống giám sát trực tuyến thời gian thực mực nước, lưu lượng nước về, lưu lượng xả qua tràn và dung tích phòng lũ các hồ chứa thủy điện lớn trên toàn quốc (Sơn La, Hòa Bình, Lai Châu, Tuyên Quang, Trị An, Yaly,...). Cảnh báo an toàn thiên tai và vận hành đón lũ.",
  keywords: [
    "thủy điện",
    "mực nước hồ chứa",
    "mực nước thủy điện",
    "lưu lượng nước về hồ",
    "lưu lượng xả tràn",
    "cảnh báo đón lũ",
    "vận hành liên hồ chứa",
    "EVN",
    "thủy điện Sơn La",
    "thủy điện Hòa Bình",
    "thủy điện Lai Châu",
    "thủy điện Tuyên Quang",
    "thủy điện Thác Bà",
    "thủy điện Trị An",
    "thủy điện Yaly",
    "thủy điện Bản Vẽ",
    "thủy điện Sông Tranh",
    "dung tích phòng lũ",
    "mực nước dâng bình thường",
    "mực nước chết",
    "mực nước đón lũ",
    "thủy văn Việt Nam",
    "giám sát hồ chứa",
    "xả lũ thủy điện",
  ],
  authors: [{ name: "Thủy Điện Việt Nam Monitoring", url: siteUrl }],
  creator: "Thủy Điện Việt Nam Monitoring System",
  publisher: "Thủy Điện Việt Nam Monitoring System",
  applicationName: "Giám sát Hồ Thủy điện",
  category: "Utilities & Environment",
  classification: "Hệ thống Giám sát Thủy văn & Hồ chứa Thủy điện Việt Nam",
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: siteUrl,
    siteName: "Giám sát Mực nước Hồ Thủy điện Việt Nam",
    title: "Giám sát Mực nước Hồ Thủy điện Việt Nam | Tra cứu Thời gian thực",
    description:
      "Hệ thống giám sát trực tuyến thời gian thực mực nước, lưu lượng nước về, lưu lượng xả qua tràn và dung tích phòng lũ các hồ chứa thủy điện lớn trên toàn quốc.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Giám sát Mực nước Hồ Thủy điện Việt Nam | Tra cứu Thời gian thực",
    description:
      "Hệ thống theo dõi thời gian thực vận hành hồ chứa, mực nước lũ, lưu lượng xả và cảnh báo an toàn thiên tai các hồ thủy điện tại Việt Nam.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": `${siteUrl}/#webapp`,
      name: "Hệ thống Giám sát Mực nước Hồ Thủy điện Việt Nam",
      url: siteUrl,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "All",
      inLanguage: "vi",
      description:
        "Hệ thống theo dõi thời gian thực dữ liệu vận hành hồ chứa, mực nước lũ, lưu lượng xả và cảnh báo an toàn thiên tai các hồ thủy điện tại Việt Nam.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "VND",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "Giám sát Mực nước Hồ Thủy điện Việt Nam",
      inLanguage: "vi",
      description: "Tra cứu và giám sát mực nước hồ thủy điện thời gian thực trên toàn quốc",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
