/**
 * Lightweight anomaly detection: flags days where modal_price deviates
 * sharply from the trailing 30-day average. No ML dependency needed —
 * this is intentionally simple and fast enough to run inside the daily cron.
 */
import { query } from "./db";

interface PriceRow {
  price_date: string;
  modal_price: string;
}

export async function detectAnomaliesForAll(): Promise<number> {
  const pairs = await query<{ commodity_id: number; market_id: number }>(
    `SELECT DISTINCT commodity_id, market_id FROM price_records`
  );

  let written = 0;
  for (const { commodity_id, market_id } of pairs) {
    const rows = await query<PriceRow>(
      `SELECT price_date, modal_price FROM price_records
       WHERE commodity_id = $1 AND market_id = $2
       ORDER BY price_date DESC LIMIT 31`,
      [commodity_id, market_id]
    );
    if (rows.length < 8) continue;

    const latest = parseFloat(rows[0].modal_price);
    const history = rows.slice(1).map((r) => parseFloat(r.modal_price));
    const avg = history.reduce((a, b) => a + b, 0) / history.length;
    if (!avg) continue;

    const deviationPct = ((latest - avg) / avg) * 100;
    const absDev = Math.abs(deviationPct);
    if (absDev < 10) continue; // not anomalous enough to flag

    const severity = absDev > 25 ? "Critical" : absDev > 15 ? "High" : "Moderate";
    const anomalyType = deviationPct > 0 ? "spike" : "drop";
    const description =
      deviationPct > 0
        ? `Price jumped ${absDev.toFixed(1)}% above the 30-day average.`
        : `Price dropped ${absDev.toFixed(1)}% below the 30-day average.`;

    await query(
      `INSERT INTO anomalies (commodity_id, market_id, detected_date, anomaly_type, severity, deviation_pct, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [commodity_id, market_id, rows[0].price_date, anomalyType, severity, deviationPct, description]
    );
    written++;
  }
  return written;
}
