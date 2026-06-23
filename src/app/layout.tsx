import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/toaster";

// Font configuration
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// Metadata configuration
export const metadata: Metadata = {
  title: {
    default: "KK & SONS Architectural Services EMS - Admin",
    template: "%s | KK & SONS Architectural Services EMS",
  },
  description:
    "Construction and workforce management platform for KK & SONS Architectural Services",
  keywords: [
    "employee management",
    "attendance tracking",
    "payroll system",
    "workforce management",
    "construction management",
  ],
  authors: [{ name: "KK & SONS Architectural Services" }],
  creator: "KK & SONS Architectural Services",
  publisher: "KK & SONS Architectural Services",
  robots: {
    index: false, // Admin dashboard should not be indexed
    follow: false,
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  manifest: "/manifest.json",
};

// Viewport configuration
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111111" },
  ],
};

// Root layout component
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preconnect to Firebase for better performance */}
        <link rel="preconnect" href="https://firebasestorage.googleapis.com" />
        <link rel="preconnect" href="https://www.googleapis.com" />
      </head>
      <body
        className={`${inter.variable} font-sans antialiased min-h-screen bg-background`}
      >
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
