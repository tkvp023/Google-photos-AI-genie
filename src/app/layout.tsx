import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Photos",
  description: "Google Photos - Pre-Search Coach MVP",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className="bg-[#f0f2f5] min-h-screen text-[#1f1f1f] font-sans antialiased flex justify-center">
        <div className="w-full max-w-[390px] min-h-screen bg-white flex flex-col relative shadow-2xl border-x border-[#e3e5e8] overflow-x-hidden">
          {children}
        </div>
      </body>
    </html>
  );
}
