import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getCommodityBySlug,
  getTodaySnapshot,
  getPriceTrend,
  listCommodities,
} from "@/lib/queries";
import { generatePriceMovementInsight } from "@/lib/insights";
import { siteConfig } from "@/lib/site-config";
import PriceTrendChart from "@/app/components/PriceTrendChart";

export const revalidate = 3600; // re-render at most once an hour

export async function generateStaticParams() {
  try {
    const commodities = await listCommodities();
    return commodities.map((c) => ({ slug: c.slug }));
  } catch {
    // DB unreachable at build time — pages will render on-demand instead (dynamicParams
    // defaults to true), so this doesn't block the build.
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const commodity = await getCommodityBySlug(slug);
  if (!commodity) return {};
  const title = `${commodity.name} Price Today — Mandi Rates Across India`;
  const description = `Today's ${commodity.name} price in mandis across India. Min, max, and modal price, 30-day trend, and AI market insight. Updated daily from Agmarknet.`;
  return {
    title,
    description,
    alternates: { canonical: `${siteConfig.url}/commodity/${commodity.slug}` },
    openGraph: { title, description, url: `${siteConfig.url}/commodity/${commodity.slug}` },
  };
}

export default async function CommodityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const commodity = await getCommodityBySlug(slug);
  if (!commodity) notFound();

  const [snapshot, trend] = await Promise.all([
    getTodaySnapshot(commodity.id),
    getPriceTrend(commodity.id, 30),
  ]);

  if (snapshot.length === 0) {
    return (
      <div className="tip-box">
        No price data yet for {commodity.name}. Check back after the next data sync.
      </div>
    );
  }

  const modalAvg = snapshot.reduce((a, r) => a + Number(r.modal_price), 0) / snapshot.length;
  const best = [...snapshot].sort((a, b) => Number(b.modal_price) - Number(a.modal_price))[0];

  // Build a quick week-over-week % change from the trend series for the AI insight.
  const sorted = [...trend].sort((a, b) => a.price_date.localeCompare(b.price_date));
  const latest = sorted[sorted.length - 1];
  const weekAgo = sorted[Math.max(0, sorted.length - 7)];
  const monthAgo = sorted[0];
  const avg30 =
    sorted.reduce((a, r) => a + Number(r.modal_price), 0) / Math.max(sorted.length, 1);
  const weekChg = weekAgo
    ? ((Number(latest.modal_price) - Number(weekAgo.modal_price)) / Number(weekAgo.modal_price)) * 100
    : 0;
  const monthChg = monthAgo
    ? ((Number(latest.modal_price) - Number(monthAgo.modal_price)) / Number(monthAgo.modal_price)) * 100
    : 0;
  const minP = Math.min(...sorted.slice(-7).map((r) => Number(r.min_price)));
  const maxP = Math.max(...sorted.slice(-7).map((r) => Number(r.max_price)));

  const insight = await generatePriceMovementInsight({
    commodity: commodity.name,
    market: best.market_name,
    modal: Number(latest?.modal_price ?? modalAvg),
    avg30,
    weekChg,
    monthChg,
    minP,
    maxP,
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${commodity.name} (Mandi Price)`,
    description: `Daily wholesale mandi price for ${commodity.name} across Indian markets.`,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "INR",
      lowPrice: Math.min(...snapshot.map((s) => Number(s.min_price))),
      highPrice: Math.max(...snapshot.map((s) => Number(s.max_price))),
      offerCount: snapshot.length,
    },
  };

  return (
    <div className="space-y-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div>
        <h1 className="text-2xl font-extrabold">{commodity.name} Price Today</h1>
        <p className="text-muted text-sm mt-1">
          {commodity.category} · Updated {snapshot[0]?.price_date} · {snapshot.length} markets reporting
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Average Modal Price" value={`₹${modalAvg.toFixed(0)}`} sub="per quintal" />
        <StatCard
          label="Best Price Today"
          value={`₹${Number(best.modal_price).toFixed(0)}`}
          sub={`${best.market_name}, ${best.state}`}
        />
        <StatCard label="30-Day Change" value={`${monthChg >= 0 ? "+" : ""}${monthChg.toFixed(1)}%`} sub="vs 30 days ago" />
      </div>

      <div className="bg-panel border border-border rounded-xl p-4">
        <h2 className="text-lg font-bold mb-3">30-Day Price Trend</h2>
        <PriceTrendChart data={sorted} />
      </div>

      <div className="tip-box">
        <b>🤖 AI Market Insight:</b> {insight}
      </div>

      <div className="bg-panel border border-border rounded-xl p-4 overflow-x-auto">
        <h2 className="text-lg font-bold mb-3">Today&apos;s Price by Market</h2>
        <table className="w-full text-sm">
          <thead className="text-muted text-left">
            <tr>
              <th className="py-2">Market</th>
              <th>State</th>
              <th>Min (₹)</th>
              <th>Max (₹)</th>
              <th>Modal (₹)</th>
            </tr>
          </thead>
          <tbody>
            {snapshot
              .sort((a, b) => Number(b.modal_price) - Number(a.modal_price))
              .map((s, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-2">{s.market_name}</td>
                  <td>{s.state}</td>
                  <td>₹{Number(s.min_price).toFixed(0)}</td>
                  <td>₹{Number(s.max_price).toFixed(0)}</td>
                  <td className="font-semibold text-accentSoft">₹{Number(s.modal_price).toFixed(0)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-panel border border-border rounded-xl p-4 border-t-4 border-t-accent">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-2xl font-extrabold text-accentSoft">{value}</div>
      <div className="text-xs text-muted mt-1">{sub}</div>
    </div>
  );
}
