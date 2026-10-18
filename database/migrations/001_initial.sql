CREATE TABLE IF NOT EXISTS stocks (
  symbol TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  exchange TEXT,
  currency TEXT,
  provider_symbol TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS stock_prices (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL REFERENCES stocks(symbol),
  trading_date DATE NOT NULL,
  open NUMERIC NOT NULL,
  high NUMERIC NOT NULL,
  low NUMERIC NOT NULL,
  close NUMERIC NOT NULL,
  adjusted_close NUMERIC,
  volume BIGINT,
  source TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (symbol, trading_date, source)
);
CREATE TABLE IF NOT EXISTS forecast_runs (
  id UUID PRIMARY KEY,
  symbol TEXT NOT NULL,
  method TEXT NOT NULL,
  horizon TEXT NOT NULL,
  input_field TEXT NOT NULL,
  parameters JSONB NOT NULL DEFAULT '{}',
  training_start_date DATE NOT NULL,
  training_end_date DATE NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model_version TEXT NOT NULL,
  metrics JSONB,
  result JSONB,
  status TEXT NOT NULL,
  error_code TEXT
);
CREATE TABLE IF NOT EXISTS forecast_points (
  id BIGSERIAL PRIMARY KEY,
  forecast_run_id UUID NOT NULL REFERENCES forecast_runs(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,
  predicted_value NUMERIC NOT NULL,
  lower_bound NUMERIC,
  upper_bound NUMERIC,
  UNIQUE (forecast_run_id, forecast_date)
);
