-- Agri Price Tracker — Postgres schema (Neon)
-- Run once via: npm run db:setup

CREATE TABLE IF NOT EXISTS commodities (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS markets (
  id SERIAL PRIMARY KEY,
  market_name TEXT NOT NULL,
  state TEXT NOT NULL,
  UNIQUE (market_name, state)
);

CREATE TABLE IF NOT EXISTS price_records (
  id BIGSERIAL PRIMARY KEY,
  commodity_id INTEGER REFERENCES commodities(id) ON DELETE CASCADE,
  market_id INTEGER REFERENCES markets(id) ON DELETE CASCADE,
  price_date DATE NOT NULL,
  min_price NUMERIC NOT NULL,
  max_price NUMERIC NOT NULL,
  modal_price NUMERIC NOT NULL,
  arrivals NUMERIC,
  source TEXT DEFAULT 'Agmarknet',
  UNIQUE (commodity_id, market_id, price_date)
);
CREATE INDEX IF NOT EXISTS idx_price_records_lookup
  ON price_records (commodity_id, market_id, price_date DESC);

CREATE TABLE IF NOT EXISTS anomalies (
  id BIGSERIAL PRIMARY KEY,
  commodity_id INTEGER REFERENCES commodities(id) ON DELETE CASCADE,
  market_id INTEGER REFERENCES markets(id) ON DELETE CASCADE,
  detected_date DATE NOT NULL,
  anomaly_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  deviation_pct NUMERIC NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_anomalies_date ON anomalies (detected_date DESC);

CREATE TABLE IF NOT EXISTS insights (
  id BIGSERIAL PRIMARY KEY,
  commodity_id INTEGER REFERENCES commodities(id) ON DELETE SET NULL,
  market_id INTEGER REFERENCES markets(id) ON DELETE SET NULL,
  insight_date DATE NOT NULL,
  insight_type TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  sentiment TEXT DEFAULT 'neutral',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
