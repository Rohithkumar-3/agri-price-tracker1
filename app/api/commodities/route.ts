import { NextResponse } from "next/server";
import { listCommodities } from "@/lib/queries";

export async function GET() {
  const commodities = await listCommodities();
  return NextResponse.json({ count: commodities.length, commodities });
}
