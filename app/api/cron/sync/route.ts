import { NextRequest, NextResponse } from "next/server";
import { fetchAndStorePrices } from "@/lib/agmarknet";
import { detectAnomaliesForAll } from "@/lib/anomalies";
import { query } from "@/lib/db";

// Pulling the FULL national daily dataset (60 pages, tens of thousands of
// upserts) takes longer than Vercel Hobby's default 10s function limit.
// This requires either Vercel Pro (300s limit) OR splitting the sync into
// smaller chunks — see the README note on this exact tradeoff.
export const maxDuration = 300;

// Vercel Cron calls this once a day (see vercel.json). It's also safe to call
// manually for testing — just include the Authorization header below.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log: string[] = [];
  try {
    const { count, latestDate } = await fetchAndStorePrices();
    log.push(`Fetched/upserted ${count} price records. Latest date: ${latestDate}`);

    const anomalies = await detectAnomaliesForAll();
    log.push(`Detected ${anomalies} anomalies.`);

    await query(
      `INSERT INTO app_meta (key, value) VALUES ('last_sync', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [new Date().toISOString()]
    );

    return NextResponse.json({ ok: true, log });
  } catch (e: any) {
    console.error("[cron/sync] failed:", e);
    return NextResponse.json({ ok: false, error: e.message, log }, { status: 500 });
  }
}
