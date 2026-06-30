/**
 * Seeds commodities, markets, and 120 days of synthetic price history
 * so the dashboard has data to show before real Agmarknet data arrives.
 * Run once: npm run db:seed
 */
import { Pool } from "pg";
import "dotenv/config";

const COMMODITIES: Record<string, string> = {
  Rice: "Cereals", Wheat: "Cereals", Maize: "Cereals", Barley: "Cereals",
  Jowar: "Cereals", Bajra: "Cereals", Ragi: "Cereals",
  "Tur Dal": "Pulses", "Moong Dal": "Pulses", "Urad Dal": "Pulses",
  "Chana Dal": "Pulses", "Masoor Dal": "Pulses",
  Tomato: "Vegetables", Onion: "Vegetables", Potato: "Vegetables",
  Brinjal: "Vegetables", Cabbage: "Vegetables", Cauliflower: "Vegetables",
  Carrot: "Vegetables", Spinach: "Vegetables", "Bitter Gourd": "Vegetables",
  Capsicum: "Vegetables",
  Banana: "Fruits", Mango: "Fruits", Apple: "Fruits", Grapes: "Fruits",
  Orange: "Fruits", Papaya: "Fruits",
  Turmeric: "Spices", Chilli: "Spices", Coriander: "Spices",
  Cumin: "Spices", Ginger: "Spices", Garlic: "Spices",
  Groundnut: "Oilseeds", Mustard: "Oilseeds", Soybean: "Oilseeds",
  Sunflower: "Oilseeds", Sesame: "Oilseeds",
};

const BASE_PRICES: Record<string, number> = {
  Rice: 2200, Wheat: 2100, Maize: 1800, Barley: 1700, Jowar: 2000, Bajra: 1900, Ragi: 2300,
  "Tur Dal": 8500, "Moong Dal": 9500, "Urad Dal": 9000, "Chana Dal": 7000, "Masoor Dal": 7500,
  Tomato: 1500, Onion: 1800, Potato: 1400, Brinjal: 1200, Cabbage: 900, Cauliflower: 1100,
  Carrot: 1600, Spinach: 1000, "Bitter Gourd": 1800, Capsicum: 2200,
  Banana: 2000, Mango: 5000, Apple: 8000, Grapes: 4500, Orange: 3500, Papaya: 1800,
  Turmeric: 8000, Chilli: 12000, Coriander: 7000, Cumin: 18000, Ginger: 6000, Garlic: 12000,
  Groundnut: 5500, Mustard: 5200, Soybean: 4800, Sunflower: 5000, Sesame: 9000,
};

const MARKETS: { market_name: string; state: string }[] = [
  { market_name: "Azadpur", state: "Delhi" },
  { market_name: "Vashi", state: "Maharashtra" },
  { market_name: "Bowenpally", state: "Telangana" },
  { market_name: "Koyambedu", state: "Tamil Nadu" },
  { market_name: "Yeshwanthpur", state: "Karnataka" },
  { market_name: "Gultekdi", state: "Maharashtra" },
];

const MARKET_PREMIUM: Record<string, number> = {
  Azadpur: 1.05, Vashi: 1.08, Bowenpally: 0.97,
  Koyambedu: 1.02, Yeshwanthpur: 1.06, Gultekdi: 1.04,
};

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function gaussian(rng: () => number) {
  const u1 = rng() || 1e-9;
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function dayOfYear(d: Date) {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not set. Add it to .env.local first.");
    process.exit(1);
  }
  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
  });

  const already = await pool.query("SELECT value FROM app_meta WHERE key = 'seeded'");
  if (already.rows[0]?.value === "true") {
    console.log("Already seeded — skipping. Delete the 'seeded' row in app_meta to force re-seed.");
    await pool.end();
    return;
  }

  // ── Try REAL Agmarknet data first ─────────────────────────────────────
  if (process.env.AGMARKNET_API_KEY) {
    console.log("AGMARKNET_API_KEY found — pulling real government data instead of synthetic...");
    try {
      const { fetchAndStorePrices } = await import("../lib/agmarknet");
      const result = await fetchAndStorePrices();
      if (result.count > 0) {
        await pool.query(
          `INSERT INTO app_meta (key, value) VALUES ('seeded', 'true'), ('seed_source', 'agmarknet'), ('seed_date', $1)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
          [new Date().toISOString().slice(0, 10)]
        );
        console.log(`✓ Seeded with ${result.count} REAL records from Agmarknet (latest date: ${result.latestDate}, ${result.pages} pages fetched).`);
        await pool.end();
        return;
      }
      console.warn("Agmarknet returned 0 usable records — falling back to synthetic data so the site isn't empty.");
    } catch (e) {
      console.warn("Agmarknet fetch failed, falling back to synthetic data:", (e as Error).message);
    }
  } else {
    console.log("No AGMARKNET_API_KEY set — generating synthetic placeholder data. Add the key and re-run for real data.");
  }

  console.log("Seeding commodities...");
  const commodityIds: Record<string, number> = {};
  for (const [name, category] of Object.entries(COMMODITIES)) {
    const { rows } = await pool.query(
      `INSERT INTO commodities (name, category) VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET category = EXCLUDED.category
       RETURNING id`,
      [name, category]
    );
    commodityIds[name] = rows[0].id;
  }

  console.log("Seeding markets...");
  const marketIds: Record<string, number> = {};
  for (const m of MARKETS) {
    const { rows } = await pool.query(
      `INSERT INTO markets (market_name, state) VALUES ($1, $2)
       ON CONFLICT (market_name, state) DO UPDATE SET state = EXCLUDED.state
       RETURNING id`,
      [m.market_name, m.state]
    );
    marketIds[m.market_name] = rows[0].id;
  }

  console.log("Generating 120 days of synthetic price history (this takes a bit)...");
  const daysBack = 120;
  const today = new Date();
  const rng = seededRandom(42);

  const rows: any[][] = [];
  for (const [name, base] of Object.entries(BASE_PRICES)) {
    const cid = commodityIds[name];
    if (!cid) continue;
    for (const m of MARKETS) {
      const mid = marketIds[m.market_name];
      const premium = MARKET_PREMIUM[m.market_name] ?? 1.0;
      for (let i = 0; i < daysBack; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const doy = dayOfYear(d);
        const seasonal = 1 + 0.15 * Math.sin((2 * Math.PI * (doy - 90)) / 365);
        const noise = gaussian(rng) * 0.03;
        const modal = Math.round(base * seasonal * premium * (1 + noise) * 100) / 100;
        const spread = 0.03 + rng() * 0.04;
        const minP = Math.round(modal * (1 - spread) * 100) / 100;
        const maxP = Math.round(modal * (1 + spread) * 100) / 100;
        const arrivals = Math.round((50 + rng() * 450) * 10) / 10;
        rows.push([cid, mid, d.toISOString().slice(0, 10), minP, maxP, modal, arrivals, "Synthetic"]);
      }
    }
  }

  console.log(`Inserting ${rows.length} price records...`);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const values: any[] = [];
      const placeholders = batch
        .map((row, idx) => {
          const base = idx * 8;
          values.push(...row);
          return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8})`;
        })
        .join(",");
      await client.query(
        `INSERT INTO price_records
          (commodity_id, market_id, price_date, min_price, max_price, modal_price, arrivals, source)
         VALUES ${placeholders}
         ON CONFLICT (commodity_id, market_id, price_date) DO NOTHING`,
        values
      );
    }
    await client.query(
      `INSERT INTO app_meta (key, value) VALUES ('seeded', 'true'), ('seed_source', 'synthetic'), ('seed_date', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [today.toISOString().slice(0, 10)]
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  console.log("✓ Seed complete.");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
