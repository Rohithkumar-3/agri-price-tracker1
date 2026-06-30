import { NextResponse } from "next/server";

export async function GET() {
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Agri Price Tracker API — Yextra</title>
<style>
  body { background:#0f1117; color:#f1f5f9; font-family: -apple-system, sans-serif; max-width: 780px; margin: 40px auto; padding: 0 20px; }
  h1 { color: #4ade80; } code, pre { background:#161b27; border:1px solid #1e2d40; border-radius:6px; padding:2px 6px; }
  pre { padding: 14px; overflow-x:auto; }
  .ep { border-left: 3px solid #16a34a; padding-left: 14px; margin: 24px 0; }
  a { color: #4ade80; }
</style></head>
<body>
  <h1>🌾 Agri Price Tracker API</h1>
  <p>Free, no API key required (for now — this may change once usage justifies rate limiting).</p>

  <div class="ep">
    <h3>GET /api/commodities</h3>
    <p>List all tracked commodities.</p>
  </div>

  <div class="ep">
    <h3>GET /api/prices?commodity=tomato&amp;days=30</h3>
    <p>Today's price across all markets + N-day trend for one commodity.</p>
    <pre>{
  "commodity": "Tomato",
  "today": [{ "market_name": "...", "state": "...", "modal_price": 1500, ... }],
  "trend": [{ "price_date": "2026-06-01", "modal_price": 1480, ... }]
}</pre>
  </div>

  <div class="ep">
    <h3>GET /api/state-analytics</h3>
    <p>Average/min/max price by state over the last 7 days.</p>
  </div>

  <div class="ep">
    <h3>POST /api/insights</h3>
    <p>Body: <code>{ "commoditySlug": "tomato" }</code> — returns an AI-generated plain-English market insight.</p>
  </div>

  <p style="margin-top:40px; color:#94a3b8; font-size:0.85rem">
    Built by Yextra · Data from <a href="https://data.gov.in" target="_blank">Agmarknet (data.gov.in)</a>
  </p>
</body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
