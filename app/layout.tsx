import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Caveat, DM_Sans } from "next/font/google";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site-url";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin", "latin-ext"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: "700",
});

const SHARE_DESCRIPTION = "Say what you need on WhatsApp. Oya asks around, checks what's true today and sees it through. Free, starting in Nigeria.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "Oya",
    "AI agent",
    "WhatsApp assistant",
    "Nigeria",
    "Uyo",
    "everyday errands",
    "plumber",
    "pharmacy",
    "NIN",
    "passport",
    "Pidgin",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SHARE_DESCRIPTION,
    locale: "en_NG",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SHARE_DESCRIPTION,
  },
  appleWebApp: { title: SITE_NAME, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false, email: false, address: false },
  robots: { index: true, follow: true },
};
export const viewport: Viewport = {
  themeColor: "#10241B",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${dmSans.variable} ${caveat.variable} antialiased`}
    >
      <body>{children}</body>
    </html>
  );
}
