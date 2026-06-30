import type { MetadataRoute } from "next";
import { listCommodities, listStates } from "@/lib/queries";
import { siteConfig } from "@/lib/site-config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url;
  const entries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1.0 },
    { url: `${base}/dashboard`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/state`, changeFrequency: "daily", priority: 0.7 },
  ];

  try {
    const commodities = await listCommodities();
    for (const c of commodities) {
      entries.push({
        url: `${base}/commodity/${c.slug}`,
        changeFrequency: "daily",
        priority: 0.9,
      });
    }
    const states = await listStates();
    for (const s of states) {
      entries.push({
        url: `${base}/state/${encodeURIComponent(s.toLowerCase().replace(/\s+/g, "-"))}`,
        changeFrequency: "daily",
        priority: 0.7,
      });
    }
  } catch {
    // DB not reachable at build time (e.g. first deploy before seeding) — sitemap still
    // returns the static routes above so the build doesn't fail.
  }

  return entries;
}
