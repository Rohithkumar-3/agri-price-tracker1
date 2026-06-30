import Link from "next/link";
import { getTopVolatility, getSummaryStats, listCommodities } from "@/lib/queries";
import { slugify } from "@/lib/queries";
import AutoInit from "@/app/components/AutoInit";

export const revalidate = 1800;

export default async function HomePage() {
  let stats, volatility, commodities;
  try {
    [stats, volatility, commodities] = await Promise.all([
      getSummaryStats(),
      getTopVolatility(8),
      listCommodities(),
    ]);
  } catch {
    return (
      <div className="tip-box">
        Database not reachable yet. Check <code>DATABASE_URL</code> in your Vercel environment variables.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AutoInit />

      {stats.is_stale && (
        <div className="alert-warn">
          ⚠️ Data hasn&apos;t updated since {stats.latest_date} — the daily sync may have failed.
          Visit <code>/api/cron/sync</code> to retry manually, or check Vercel function logs.
        </div>
      )}
      <div className="bg-gradient-to-br from-[#052e16] via-[#14532d] to-[#166534] border border-accent rounded-2xl p-8">
        <h1 className="text-3xl font-extrabold text-green-50">🌾 Agri Price Tracker by Yextra</h1>
        <p className="text-green-200 mt-2">
          Live mandi commodity prices across India · Updated daily from Agmarknet · AI-powered market insights
        </p>
        <p className="text-green-300/80 text-sm mt-3">
          {stats?.total_commodities ?? 0} commodities · {stats?.total_markets ?? 0} mandis ·{" "}
          {stats?.total_states ?? 0} states · Last updated {stats?.latest_date ?? "—"}
        </p>
      </div>

      <section>
        <h2 className="text-lg font-bold mb-3">📊 Most Volatile Commodities (Last 30 Days)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {volatility.map((v) => (
            <Link
              key={v.commodity_id}
              href={`/commodity/${slugify(v.commodity_name)}`}
              className="bg-panel border border-border rounded-xl p-3 hover:border-accent transition"
            >
              <div className="font-semibold text-sm">{v.commodity_name}</div>
              <div className="text-accentSoft text-lg font-bold">{v.volatility_pct}%</div>
              <div className="text-xs text-muted">avg ₹{v.avg_price}</div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3">🌱 All Commodities</h2>
        <div className="flex flex-wrap gap-2">
          {commodities.map((c) => (
            <Link
              key={c.id}
              href={`/commodity/${c.slug}`}
              className="text-sm bg-panel border border-border rounded-full px-3 py-1.5 hover:border-accent hover:text-accentSoft transition"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </section>

      <div className="text-center">
        <Link
          href="/dashboard"
          className="inline-block bg-accent hover:bg-green-600 text-white font-semibold px-5 py-2.5 rounded-lg transition"
        >
          Open Full Dashboard →
        </Link>
      </div>
    </div>
  );
}
