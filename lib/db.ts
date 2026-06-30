import { Pool, types } from "pg";

// pg auto-converts Postgres DATE columns into JS Date objects by default,
// which silently breaks every place in this codebase that treats price_date
// as a 'YYYY-MM-DD' string (sorting via localeCompare, .slice(5) for chart
// labels, string comparisons like `dateA > dateB`). Force DATE (oid 1082)
// to stay a raw string instead — this matches how dates are produced
// everywhere else (e.g. parseAgmarknetDate in lib/agmarknet.ts).
types.setTypeParser(1082, (val) => val);

// Postgres internal NUMERIC oid (1700) — bonus safety net: NUMERIC sometimes
// comes back as a string already, but pin it explicitly so prices never end
// up as PG's NUMERIC-string wrapped object if a driver upgrade changes that.
types.setTypeParser(1700, (val) => val);

// Neon (and most serverless Postgres providers) require SSL.
// A single pooled connection is reused across warm Vercel Function invocations.
let pool: Pool | undefined;

export function db(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Add it in .env.local (dev) or Vercel → Settings → Environment Variables (prod)."
      );
    }
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const { rows } = await db().query(text, params);
  return rows as T[];
}
