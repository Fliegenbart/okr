import type { Metadata } from "next";
import { Geist, Geist_Mono, Sora, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "OKR für Paare",
  description: "Gemeinsame Objectives, klare Key Results, echte Nähe.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport = {
  themeColor: "#F20080",
  width: "device-width",
  initialScale: 1,
  // `viewport-fit=cover` lets the app extend under the iOS notch and home
  // indicator. Pages still respect safe-area insets via CSS utilities.
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${sourceSans.variable} ${sora.variable} antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
