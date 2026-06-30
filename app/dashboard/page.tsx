import type { Metadata } from "next";
import { listCommodities, listMarkets, type Commodity, type Market } from "@/lib/queries";
import DashboardClient from "./DashboardClient";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Filter mandi prices by commodity and market, view trends, and generate AI insights.",
};

export const revalidate = 1800;

export default async function DashboardPage() {
  let commodities: Commodity[] = [];
  let markets: Market[] = [];
  try {
    [commodities, markets] = await Promise.all([listCommodities(), listMarkets()]);
  } catch {
    return (
      <div className="tip-box">
        Database not reachable. Set <code>DATABASE_URL</code> and run{" "}
        <code>npm run db:setup && npm run db:seed</code> first.
      </div>
    );
  }
  return <DashboardClient commodities={commodities} markets={markets} />;
}
