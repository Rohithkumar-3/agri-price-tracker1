import { query } from "./db";

export interface Commodity {
  id: number;
  name: string;
  category: string;
  slug: string;
}
export interface Market {
  id: number;
  market_name: string;
  state: string;
  slug: string;
}

export function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function listCommodities(): Promise<Commodity[]> {
  const rows = await query<{ id: number; name: string; category: string }>(
    "SELECT id, name, category FROM commodities ORDER BY name"
  );
  return rows.map((r) => ({ ...r, slug: slugify(r.name) }));
}

export async function listMarkets(): Promise<Market[]> {
  const rows = await query<{ id: number; market_name: string; state: string }>(
    "SELECT id, market_name, state FROM markets ORDER BY state, market_name"
  );
  return rows.map((r) => ({ ...r, slug: slugify(r.market_name) }));
}

export async function getCommodityBySlug(slug: string): Promise<Commodity | null> {
  const all = await listCommodities();
  return all.find((c) => c.slug === slug) ?? null;
}

export async function listStates(): Promise<string[]> {
  const rows = await query<{ state: string }>("SELECT DISTINCT state FROM markets ORDER BY state");
  return rows.map((r) => r.state);
}

export interface PriceTrendRow {
  price_date: string;
  min_price: number;
  max_price: number;
  modal_price: number;
  market_name: string;
  state: string;
}

/** Trend for one commodity, across all markets (or one if marketId given), last N days. */
export async function getPriceTrend(
  commodityId: number,
  days = 30,
  marketId?: number
): Promise<PriceTrendRow[]> {
  const params: any[] = [commodityId, days];
  let marketFilter = "";
  if (marketId) {
    params.push(marketId);
    marketFilter = "AND p.market_id = $3";
  }
  return query<PriceTrendRow>(
    `SELECT p.price_date, p.min_price, p.max_price, p.modal_price, m.market_name, m.state
     FROM price_records p
     JOIN markets m ON m.id = p.market_id
     WHERE p.commodity_id = $1
       AND p.price_date >= (CURRENT_DATE - $2::int)
       ${marketFilter}
     ORDER BY p.price_date ASC`,
    params
  );
}

export interface TodaySnapshot {
  market_name: string;
  state: string;
  min_price: number;
  max_price: number;
  modal_price: number;
  price_date: string;
}

/** Latest price for a commodity in every market that has it. */
export async function getTodaySnapshot(commodityId: number): Promise<TodaySnapshot[]> {
  return query<TodaySnapshot>(
    `SELECT DISTINCT ON (p.market_id)
        m.market_name, m.state, p.min_price, p.max_price, p.modal_price, p.price_date
     FROM price_records p
     JOIN markets m ON m.id = p.market_id
     WHERE p.commodity_id = $1
     ORDER BY p.market_id, p.price_date DESC`,
    [commodityId]
  );
}

export interface VolatilityRow {
  commodity_id: number;
  commodity_name: string;
  volatility_pct: number;
  avg_price: number;
}

/** Top N most volatile commodities over the last 30 days (used for homepage + AI summary). */
export async function getTopVolatility(limit = 10): Promise<VolatilityRow[]> {
  return query<VolatilityRow>(
    `SELECT c.id AS commodity_id, c.name AS commodity_name,
            ROUND(((MAX(p.modal_price) - MIN(p.modal_price)) / NULLIF(AVG(p.modal_price), 0) * 100)::numeric, 1) AS volatility_pct,
            ROUND(AVG(p.modal_price)::numeric, 0) AS avg_price
     FROM price_records p
     JOIN commodities c ON c.id = p.commodity_id
     WHERE p.price_date >= (CURRENT_DATE - 30)
     GROUP BY c.id, c.name
     ORDER BY volatility_pct DESC
     LIMIT $1`,
    [limit]
  );
}

export interface StateAnalyticsRow {
  state: string;
  num_markets: number;
  avg_price: number;
  max_price: number;
  min_price: number;
}

export async function getStateAnalytics(): Promise<StateAnalyticsRow[]> {
  return query<StateAnalyticsRow>(
    `SELECT m.state,
            COUNT(DISTINCT m.id) AS num_markets,
            ROUND(AVG(p.modal_price)::numeric, 0) AS avg_price,
            ROUND(MAX(p.modal_price)::numeric, 0) AS max_price,
            ROUND(MIN(p.modal_price)::numeric, 0) AS min_price
     FROM price_records p
     JOIN markets m ON m.id = p.market_id
     WHERE p.price_date >= (CURRENT_DATE - 7)
     GROUP BY m.state
     ORDER BY avg_price DESC`
  );
}

export interface StateMarketRow {
  market_id: number;
  market_name: string;
  commodity_name: string;
  modal_price: number;
  price_date: string;
}

/** Resolves a URL slug like "tamil-nadu" back to the real state name, case-insensitively. */
export async function resolveStateSlug(slug: string): Promise<string | null> {
  const states = await listStates();
  const match = states.find((s) => s.toLowerCase().replace(/\s+/g, "-") === slug);
  return match ?? null;
}

export async function getStateDetail(state: string): Promise<StateMarketRow[]> {
  return query<StateMarketRow>(
    `SELECT DISTINCT ON (m.id, c.id)
        m.id AS market_id, m.market_name, c.name AS commodity_name,
        p.modal_price, p.price_date
     FROM price_records p
     JOIN markets m ON m.id = p.market_id
     JOIN commodities c ON c.id = p.commodity_id
     WHERE m.state = $1
     ORDER BY m.id, c.id, p.price_date DESC
     LIMIT 200`,
    [state]
  );
}

export async function getSummaryStats() {
  const [row] = await query<{
    total_commodities: number;
    total_markets: number;
    total_states: number;
    latest_date: string | null;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM commodities) AS total_commodities,
       (SELECT COUNT(*) FROM markets) AS total_markets,
       (SELECT COUNT(DISTINCT state) FROM markets) AS total_states,
       (SELECT MAX(price_date) FROM price_records)::text AS latest_date`
  );
  return row;
}
