"use client";

import { useState, useMemo } from "react";
import PriceTrendChart from "@/app/components/PriceTrendChart";
import type { Commodity, Market } from "@/lib/queries";

export default function DashboardClient({
  commodities,
  markets,
}: {
  commodities: Commodity[];
  markets: Market[];
}) {
  const [commoditySlug, setCommoditySlug] = useState(commodities[0]?.slug ?? "");
  const [days, setDays] = useState(30);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);

  const states = useMemo(() => Array.from(new Set(markets.map((m) => m.state))).sort(), [markets]);

  async function loadPrices(slug: string, d: number) {
    setLoading(true);
    setInsight(null);
    try {
      const res = await fetch(`/api/prices?commodity=${slug}&days=${d}`);
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  async function generateInsight() {
    setInsightLoading(true);
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commoditySlug }),
      });
      const json = await res.json();
      setInsight(json.insight);
      setProvider(json.provider);
    } finally {
      setInsightLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
      <aside className="bg-panel border border-border rounded-xl p-4 space-y-4 h-fit">
        <div>
          <label className="text-xs text-muted">Commodity</label>
          <select
            className="w-full mt-1 bg-bg border border-border rounded-lg p-2 text-sm"
            value={commoditySlug}
            onChange={(e) => setCommoditySlug(e.target.value)}
          >
            {commodities.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted">Days</label>
          <select
            className="w-full mt-1 bg-bg border border-border rounded-lg p-2 text-sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {[7, 14, 30, 60, 90].map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>
        </div>
        <button
          className="w-full bg-accent hover:bg-green-600 text-white font-semibold py-2 rounded-lg text-sm"
          onClick={() => loadPrices(commoditySlug, days)}
        >
          {loading ? "Loading..." : "Load Prices"}
        </button>
        <p className="text-xs text-muted">{states.length} states · {markets.length} markets tracked</p>
      </aside>

      <section className="space-y-6">
        {!data && (
          <div className="tip-box">👈 Pick a commodity and click "Load Prices" to see trends.</div>
        )}

        {data?.today?.length > 0 && (
          <div className="bg-panel border border-border rounded-xl p-4 overflow-x-auto">
            <h2 className="text-lg font-bold mb-3">Today&apos;s Price — {data.commodity}</h2>
            <table className="w-full text-sm">
              <thead className="text-muted text-left">
                <tr>
                  <th className="py-2">Market</th>
                  <th>State</th>
                  <th>Min</th>
                  <th>Max</th>
                  <th>Modal</th>
                </tr>
              </thead>
              <tbody>
                {data.today.map((r: any, i: number) => (
                  <tr key={i} className="border-t border-border">
                    <td className="py-2">{r.market_name}</td>
                    <td>{r.state}</td>
                    <td>₹{Number(r.min_price).toFixed(0)}</td>
                    <td>₹{Number(r.max_price).toFixed(0)}</td>
                    <td className="font-semibold text-accentSoft">₹{Number(r.modal_price).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data?.trend?.length > 0 && (
          <div className="bg-panel border border-border rounded-xl p-4">
            <h2 className="text-lg font-bold mb-3">Price Trend</h2>
            <PriceTrendChart data={data.trend} />
          </div>
        )}

        {data && (
          <div>
            <button
              className="bg-accent hover:bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-lg"
              onClick={generateInsight}
            >
              {insightLoading ? "Asking AI..." : "✨ Generate AI Insight"}
            </button>
            {insight && (
              <div className="tip-box mt-3">
                <div className="text-xs text-muted mb-1">Provider: {provider}</div>
                {insight}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
