import { NextRequest, NextResponse } from "next/server";
import { db, query } from "@/lib/db";
import { SCHEMA_SQL } from "@/lib/schema";
import { fetchAndStorePrices } from "@/lib/agmarknet";
import { detectAnomaliesForAll } from "@/lib/anomalies";

// Applies the schema and pulls the first batch of REAL Agmarknet data — meant
// to be visited ONCE, in a browser, right after your first deploy, when you
// have no local DB access to run `npm run db:setup` / `db:seed`. Safe to call
// again later (CREATE TABLE IF NOT EXISTS + upserts), but there's no reason to.
//
// Pulling the full national dataset takes a few minutes — this needs Vercel
// Pro's longer function timeout. On Hobby it will likely cut off partway
// through; re-visiting the URL a few times will keep making progress since
// every page already fetched is committed to the DB along the way.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "Pass ?secret=<your CRON_SECRET> in the URL, or unset CRON_SECRET to skip this check." },
      { status: 401 }
    );
  }

  const log: string[] = [];

  try {
    log.push("Applying schema...");
    await db().query(SCHEMA_SQL);
    log.push("✓ Schema ready.");

    if (!process.env.AGMARKNET_API_KEY) {
      return NextResponse.json({
        ok: false,
        log,
        error: "AGMARKNET_API_KEY is not set in Vercel env vars — add it, redeploy, then revisit this URL.",
      });
    }

    log.push("Fetching real data from Agmarknet (this can take a few minutes)...");
    const { count, latestDate, pages } = await fetchAndStorePrices();
    log.push(`✓ Stored ${count} records across ${pages} page(s). Latest date: ${latestDate}`);

    log.push("Running anomaly detection...");
    const anomalies = await detectAnomaliesForAll();
    log.push(`✓ Flagged ${anomalies} anomalies.`);

    await query(
      `INSERT INTO app_meta (key, value) VALUES ('seeded', 'true'), ('seed_source', 'agmarknet'), ('last_sync', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [new Date().toISOString()]
    );

    return NextResponse.json({ ok: true, log, note: "Done. Your site is now live with real data. You can delete or ignore this endpoint going forward — daily cron takes over from here." });
  } catch (e: any) {
    console.error("[admin/bootstrap] failed:", e);
    return NextResponse.json({ ok: false, log, error: e.message }, { status: 500 });
  }
}
