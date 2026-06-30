/**
 * Fetches daily mandi prices from data.gov.in's Agmarknet resource and
 * upserts into Postgres. Ports the core logic of data_pipeline.py.
 * Resource ID: 9ef84268-d588-465a-a308-a864a43d0070
 */
import { query } from "./db";

const RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070";

interface AgmarknetRecord {
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety?: string;
  grade?: string;
  arrival_date: string; // DD/MM/YYYY
  min_price: string;
  max_price: string;
  modal_price: string;
}

function parseAgmarknetDate(d: string): string {
  // "27/06/2026" -> "2026-06-27"
  const [dd, mm, yyyy] = d.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

async function getOrCreateCommodity(name: string): Promise<number> {
  const existing = await query<{ id: number }>(
    "SELECT id FROM commodities WHERE name = $1",
    [name]
  );
  if (existing[0]) return existing[0].id;
  const inserted = await query<{ id: number }>(
    `INSERT INTO commodities (name, category) VALUES ($1, 'Uncategorized')
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [name]
  );
  return inserted[0].id;
}

async function getOrCreateMarket(marketName: string, state: string): Promise<number> {
  const existing = await query<{ id: number }>(
    "SELECT id FROM markets WHERE market_name = $1 AND state = $2",
    [marketName, state]
  );
  if (existing[0]) return existing[0].id;
  const inserted = await query<{ id: number }>(
    `INSERT INTO markets (market_name, state) VALUES ($1, $2)
     ON CONFLICT (market_name, state) DO UPDATE SET state = EXCLUDED.state RETURNING id`,
    [marketName, state]
  );
  return inserted[0].id;
}

/**
 * Fetches the latest records from Agmarknet and stores them.
 * Paginates through the FULL result set (data.gov.in caps each page at 2000
 * records, but a single day's national dataset runs into the tens of
 * thousands across all commodities/markets) — without this loop, only the
 * first page ever got stored, which is why coverage looked incomplete.
 * Returns the number of records written.
 */
export async function fetchAndStorePrices(): Promise<{ count: number; latestDate: string | null; pages: number }> {
  const apiKey = process.env.AGMARKNET_API_KEY;
  if (!apiKey) {
    throw new Error("AGMARKNET_API_KEY is not set");
  }

  const PAGE_SIZE = 2000;
  const MAX_PAGES = 60; // safety cap (~120k records) so a single bad run can't loop forever
  let offset = 0;
  let page = 0;
  let count = 0;
  let latestDate: string | null = null;

  while (page < MAX_PAGES) {
    const url =
      `https://api.data.gov.in/resource/${RESOURCE_ID}` +
      `?api-key=${apiKey}&format=json&limit=${PAGE_SIZE}&offset=${offset}`;

    let res: Response | null = null;
    let lastErr: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        res = await fetch(url);
        if (res.ok) break;
        lastErr = new Error(`HTTP ${res.status}`);
      } catch (e) {
        lastErr = e;
      }
      if (attempt < 2) await new Promise((r) => setTimeout(r, 2000 * (attempt + 1))); // backoff: 2s, 4s
    }
    if (!res || !res.ok) {
      throw new Error(`Agmarknet API failed after 3 attempts at offset ${offset}: ${lastErr?.message ?? "unknown error"}`);
    }
    const data = await res.json();
    const records: AgmarknetRecord[] = data.records ?? [];
    if (records.length === 0) break; // no more pages

    for (const r of records) {
      if (!r.modal_price || !r.market || !r.commodity) continue;
      const priceDate = parseAgmarknetDate(r.arrival_date);
      if (!latestDate || priceDate > latestDate) latestDate = priceDate;

      const commodityId = await getOrCreateCommodity(r.commodity.trim());
      const marketId = await getOrCreateMarket(r.market.trim(), r.state.trim());

      const minP = parseFloat(r.min_price) || 0;
      const maxP = parseFloat(r.max_price) || 0;
      const modalP = parseFloat(r.modal_price) || 0;
      if (!modalP) continue;

      await query(
        `INSERT INTO price_records
          (commodity_id, market_id, price_date, min_price, max_price, modal_price, source)
         VALUES ($1, $2, $3, $4, $5, $6, 'Agmarknet')
         ON CONFLICT (commodity_id, market_id, price_date)
         DO UPDATE SET min_price = EXCLUDED.min_price,
                       max_price = EXCLUDED.max_price,
                       modal_price = EXCLUDED.modal_price`,
        [commodityId, marketId, priceDate, minP, maxP, modalP]
      );
      count++;
    }

    page++;
    offset += PAGE_SIZE;
    if (records.length < PAGE_SIZE) break; // last page was partial — we're done
  }

  return { count, latestDate, pages: page };
}
