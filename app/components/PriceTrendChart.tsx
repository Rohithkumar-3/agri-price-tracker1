"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface TrendPoint {
  price_date: string;
  modal_price: number | string;
}

export default function PriceTrendChart({ data }: { data: TrendPoint[] }) {
  // Collapse multi-market rows to a daily average so the line is readable.
  const byDate = new Map<string, { sum: number; count: number }>();
  for (const d of data) {
    const v = Number(d.modal_price);
    const entry = byDate.get(d.price_date) ?? { sum: 0, count: 0 };
    entry.sum += v;
    entry.count += 1;
    byDate.set(d.price_date, entry);
  }
  const chartData = Array.from(byDate.entries())
    .map(([date, { sum, count }]) => ({ date: date.slice(5), price: Math.round(sum / count) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (chartData.length === 0) {
    return <div className="text-muted text-sm py-8 text-center">Not enough data yet for a trend chart.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData}>
        <CartesianGrid stroke="#1e2d40" strokeDasharray="3 3" />
        <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
        <YAxis stroke="#94a3b8" fontSize={12} width={50} />
        <Tooltip
          contentStyle={{ background: "#161b27", border: "1px solid #1e2d40", borderRadius: 8 }}
          labelStyle={{ color: "#f1f5f9" }}
          formatter={(value: number) => [`₹${value}`, "Modal Price"]}
        />
        <Line type="monotone" dataKey="price" stroke="#16a34a" strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
