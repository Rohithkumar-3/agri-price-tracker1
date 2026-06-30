import type { Metadata } from "next";
import "./globals.css";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.fullName} — Live Mandi Prices Across India`,
    template: `%s | ${siteConfig.fullName}`,
  },
  description: siteConfig.description,
  openGraph: {
    title: siteConfig.fullName,
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.fullName,
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.fullName,
    description: siteConfig.description,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-text font-sans antialiased">
        <header className="border-b border-border bg-panel">
          <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
            <a href="/" className="flex items-baseline gap-2">
              <span className="text-lg font-extrabold text-accentSoft">🌾 Agri Price Tracker</span>
              <span className="text-xs text-muted">by {siteConfig.brand}</span>
            </a>
            <nav className="flex gap-5 text-sm text-muted">
              <a href="/dashboard" className="hover:text-text">Dashboard</a>
              <a href="/state" className="hover:text-text">States</a>
              <a href="/api/docs" className="hover:text-text">API</a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        <footer className="border-t border-border mt-12 py-6 text-center text-xs text-muted">
          {siteConfig.fullName} · Data from Agmarknet (data.gov.in) · Built by {siteConfig.brand}
        </footer>
      </body>
    </html>
  );
}
