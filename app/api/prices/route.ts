import { NextRequest, NextResponse } from "next/server";
import { getCommodityBySlug, getPriceTrend, getTodaySnapshot } from "@/lib/queries";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("commodity");
  const days = parseInt(searchParams.get("days") ?? "30", 10);

  if (!slug) {
    return NextResponse.json(
      { error: "Pass ?commodity=<slug>, e.g. /api/prices?commodity=tomato" },
      { status: 400 }
    );
  }

  const commodity = await getCommodityBySlug(slug);
  if (!commodity) {
    return NextResponse.json({ error: `Unknown commodity slug: ${slug}` }, { status: 404 });
  }

  const [trend, today] = await Promise.all([
    getPriceTrend(commodity.id, days),
    getTodaySnapshot(commodity.id),
  ]);

  return NextResponse.json({ commodity: commodity.name, today, trend });
}
