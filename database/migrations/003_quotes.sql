CREATE TABLE IF NOT EXISTS stock_quotes (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL REFERENCES stocks(symbol),
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  exchange TEXT,
  source TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS stock_quotes_symbol_observed_at_idx
  ON stock_quotes(symbol, observed_at DESC);
