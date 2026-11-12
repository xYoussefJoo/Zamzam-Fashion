import type { Metadata, Viewport } from "next";
import { Cairo, Tajawal, DM_Sans } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-cairo",
  display: "swap",
});

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

// The live domain, set in Vercel (NEXT_PUBLIC_SITE_URL); share links and the sitemap are built from it.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const title = "زمزم فاشون | Zamzam Fashion";
const description = "أزياء نسائية راقية وتفصيل خاص على مقاسك | Curated women's fashion and custom tailoring in Egypt";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  // The share image is app/opengraph-image.jpg (WhatsApp, Facebook, X previews).
  openGraph: { type: "website", siteName: "Zamzam Fashion", locale: "ar_EG", title, description, url: "/" },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = { themeColor: "#142b4a" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} ${tajawal.variable} ${dmSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Apply the saved language before the first paint, so English visitors don't see the page flip from right-to-left. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "try{if(localStorage.getItem('zamzam_lang')==='en'){var d=document.documentElement;d.lang='en';d.dir='ltr'}}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
