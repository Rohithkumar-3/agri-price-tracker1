# Agri Price Tracker by Yextra

Next.js + Postgres rewrite of the original Streamlit project, built to run natively on Vercel
(SSR pages, free SEO-able commodity/state pages, daily Cron sync, AI insights via Gemini/Groq).

## What's here vs. what's deferred

**Built now:** live mandi prices, 30-day trends, AI market insights (free tier), per-commodity
and per-state SEO pages with metadata/sitemap/robots.txt, a free public REST API, a daily cron
sync from Agmarknet, and simple statistical anomaly detection.

**Deliberately deferred** until there's real traffic to justify them: blog/CMS, admin panel,
user accounts/alerts, AdSense, API keys & rate limiting, ML price forecasting. See the chat
history with Claude for the reasoning — building these now, before you have users, is wasted
effort relative to getting the core product live and indexed.

## 1. Local setup

```bash
npm install
cp .env.example .env.local
# fill in DATABASE_URL at minimum to run locally
npm run db:setup   # applies db/schema.sql
npm run db:seed    # 120 days of synthetic price history so the UI isn't empty
npm run dev
```

## 2. Get a database (Neon, via Vercel)

1. In your Vercel project dashboard → **Storage** tab → **Create Database** → choose **Neon (Postgres)**.
2. Vercel auto-injects `DATABASE_URL` into your project's environment variables.
3. Copy that same connection string into `.env.local` for local development.
4. Run `npm run db:setup && npm run db:seed` once, pointed at that database.

Free tier is generous enough for an MVP (no credit card required to start).

## 3. Get free AI + data API keys

- **Agmarknet** (real price data): https://data.gov.in → Login → My Account → API Keys
- **Gemini** (AI insights, 500 req/day free): https://aistudio.google.com/app/apikey
- **Groq** (AI insights fallback, 14,400 req/day free): https://console.groq.com/keys

Set these in Vercel → Settings → Environment Variables (and in `.env.local` for dev).
No key set → AI insights still work, just using the rule-based fallback in `lib/insights.ts`.

## 4. Deploy

```bash
npx vercel
```

Or connect the GitHub repo in the Vercel dashboard for auto-deploys on push.

After your first deploy:
- Set `NEXT_PUBLIC_SITE_URL` to your real domain (e.g. `https://agri.yextra.co.in`) so canonical
  URLs, the sitemap, and OG tags are correct.
- Point the `agri.yextra.co.in` subdomain at this Vercel project (Vercel → Domains).
- The cron job in `vercel.json` runs daily at 13:30 UTC (19:00 IST) — adjust if Agmarknet's
  daily data release time is different. **Vercel Hobby (free) allows once-per-day cron.** If you
  want to check more often without upgrading to Pro, point a free external scheduler
  (e.g. GitHub Actions on a schedule, or cron-job.org) at `https://yourdomain/api/cron/sync`
  with header `Authorization: Bearer <CRON_SECRET>`.

## 5. Where things live (mapped from the old Streamlit project)

| Old (Python) | New (this repo) |
|---|---|
| `database.py` (JSON files) | `db/schema.sql` + `lib/db.ts` (Postgres) |
| `data_pipeline.py` | `lib/agmarknet.ts` |
| `ml_models.py` (anomaly part) | `lib/anomalies.ts` (statistical, no ML dep) |
| `ai_insights.py` | `lib/insights.ts` |
| `smart_scheduler.py` | `vercel.json` cron → `app/api/cron/sync/route.ts` |
| `app.py` tabs | `app/dashboard/` (interactive) + `app/commodity/[slug]`, `app/state/[slug]` (SEO) |
| `api.py` | `app/api/*/route.ts` |
| `fast_seed.py` | `db/seed.ts` |

## 6. Realistic next milestones

Don't chase revenue numbers on a deadline — chase these, in order:
1. Real Agmarknet data flowing daily (not just synthetic seed data).
2. Google Search Console set up, sitemap submitted, a handful of commodity pages indexed.
3. First organic visits showing up in analytics (this takes weeks, not days).
4. *Then* worry about AdSense / monetization — you need an audience before you can sell to one.
