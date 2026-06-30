import { Pool } from "pg";

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
