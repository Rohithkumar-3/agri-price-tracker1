import { NextRequest, NextResponse } from "next/server";
import { getCommodityBySlug, getPriceTrend } from "@/lib/queries";
import { generatePriceMovementInsight, aiProviderStatus } from "@/lib/insights";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const slug = body.commoditySlug;
  if (!slug) {
    return NextResponse.json({ error: "Pass { commoditySlug } in the request body" }, { status: 400 });
  }

  const commodity = await getCommodityBySlug(slug);
  if (!commodity) {
    return NextResponse.json({ error: `Unknown commodity slug: ${slug}` }, { status: 404 });
  }

  const trend = (await getPriceTrend(commodity.id, 30)).sort((a, b) =>
    a.price_date.localeCompare(b.price_date)
  );
  if (trend.length < 7) {
    return NextResponse.json({
      insight: "Not enough data yet to generate an insight for this commodity.",
      provider: aiProviderStatus(),
    });
  }

  const latest = trend[trend.length - 1];
  const weekAgo = trend[Math.max(0, trend.length - 7)];
  const monthAgo = trend[0];
  const avg30 = trend.reduce((a, r) => a + Number(r.modal_price), 0) / trend.length;
  const weekChg =
    ((Number(latest.modal_price) - Number(weekAgo.modal_price)) / Number(weekAgo.modal_price)) * 100;
  const monthChg =
    ((Number(latest.modal_price) - Number(monthAgo.modal_price)) / Number(monthAgo.modal_price)) * 100;
  const recent = trend.slice(-7);
  const minP = Math.min(...recent.map((r) => Number(r.min_price)));
  const maxP = Math.max(...recent.map((r) => Number(r.max_price)));

  const insight = await generatePriceMovementInsight({
    commodity: commodity.name,
    market: latest.market_name,
    modal: Number(latest.modal_price),
    avg30,
    weekChg,
    monthChg,
    minP,
    maxP,
  });

  return NextResponse.json({ insight, provider: aiProviderStatus() });
}
