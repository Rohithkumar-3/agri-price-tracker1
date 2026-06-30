import { NextResponse } from "next/server";
import { getStateAnalytics } from "@/lib/queries";

export async function GET() {
  const data = await getStateAnalytics();
  return NextResponse.json({ states: data });
}
