import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const [row] = await query<{ total: string; states: string; source: string | null }>(
      `SELECT
         (SELECT COUNT(*) FROM price_records)::text AS total,
         (SELECT COUNT(DISTINCT state) FROM markets)::text AS states,
         (SELECT value FROM app_meta WHERE key = 'seed_source') AS source`
    );
    return NextResponse.json({
      ready: parseInt(row.total, 10) > 0,
      totalRecords: parseInt(row.total, 10),
      totalStates: parseInt(row.states, 10),
      source: row.source,
    });
  } catch {
    return NextResponse.json({ ready: false, totalRecords: 0, totalStates: 0, source: null, dbUnreachable: true });
  }
}
