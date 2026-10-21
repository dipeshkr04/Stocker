export type Horizon = "1d" | "1w" | "1m" | "6m" | "1y";
export type Method =
  | "mean"
  | "moving_average"
  | "exponential_smoothing"
  | "trend_projection"
  | "linear_regression"
  | "arima";

export interface SymbolResult {
  symbol: string;
  name: string;
  exchange: string | null;
  currency: string | null;
}

export interface DailyBar {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjustedClose: number | null;
  volume: number | null;
  currency: string;
  source: string;
}

export interface Quote {
  symbol: string;
  price: number;
  currency: string;
  exchange: string | null;
  source: string;
  observedAt: string;
  freshness: "latest_available" | "real_time";
}

export interface QuoteStore {
  saveQuote(quote: Quote): Promise<void>;
}

export interface MarketDataProvider {
  readonly source: string;
  searchSymbols(query: string): Promise<SymbolResult[]>;
  getLatestQuote(symbol: string): Promise<Quote>;
  getDailyHistory(symbol: string, startDate?: string, endDate?: string): Promise<DailyBar[]>;
}
