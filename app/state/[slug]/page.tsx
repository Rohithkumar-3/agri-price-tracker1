import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveStateSlug, getStateDetail } from "@/lib/queries";
import { siteConfig } from "@/lib/site-config";

export const revalidate = 1800;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const state = await resolveStateSlug(slug);
  if (!state) return {};
  const title = `${state} Mandi Prices Today — Commodity Rates`;
  const description = `Today's commodity mandi prices across markets in ${state}. Updated daily from Agmarknet.`;
  return {
    title,
    description,
    alternates: { canonical: `${siteConfig.url}/state/${slug}` },
  };
}

export default async function StateDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const state = await resolveStateSlug(slug);
  if (!state) notFound();
  const rows = await getStateDetail(state);

  const byMarket = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byMarket.get(r.market_name) ?? [];
    list.push(r);
    byMarket.set(r.market_name, list);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">{state} — Mandi Prices Today</h1>
      {[...byMarket.entries()].map(([market, items]) => (
        <div key={market} className="bg-panel border border-border rounded-xl p-4">
          <h2 className="font-bold mb-2">{market}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            {items.map((it) => (
              <div key={it.commodity_name} className="bg-bg border border-border rounded-lg p-2">
                <div className="text-muted text-xs">{it.commodity_name}</div>
                <div className="text-accentSoft font-bold">₹{Number(it.modal_price).toFixed(0)}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {rows.length === 0 && <p className="text-muted">No data yet for {state}.</p>}
    </div>
  );
}
