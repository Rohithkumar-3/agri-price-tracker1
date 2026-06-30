import Link from "next/link";
import type { Metadata } from "next";
import { getStateAnalytics } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Mandi Prices by State",
  description: "Compare average commodity prices across Indian states, updated daily.",
};

export const revalidate = 1800;

function slugifyState(s: string) {
  return s.toLowerCase().replace(/\s+/g, "-");
}

export default async function StatesPage() {
  let states: Awaited<ReturnType<typeof getStateAnalytics>> = [];
  try {
    states = await getStateAnalytics();
  } catch {
    return (
      <div className="tip-box">
        Database not reachable. Set <code>DATABASE_URL</code> and run{" "}
        <code>npm run db:setup && npm run db:seed</code> first.
      </div>
    );
  }
  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-4">🗺️ Mandi Prices by State</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {states.map((s) => (
          <Link
            key={s.state}
            href={`/state/${slugifyState(s.state)}`}
            className="bg-panel border border-border rounded-xl p-4 hover:border-accent transition"
          >
            <div className="font-bold">{s.state}</div>
            <div className="text-accentSoft text-xl font-extrabold">₹{s.avg_price}</div>
            <div className="text-xs text-muted">{s.num_markets} markets · avg modal price/quintal</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
