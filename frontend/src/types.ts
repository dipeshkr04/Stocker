export type Method =
  | "mean"
  | "moving_average"
  | "exponential_smoothing"
  | "trend_projection"
  | "linear_regression"
  | "arima";
export type Horizon = "1d" | "1w" | "1m" | "6m" | "1y";

export interface SymbolResult {
  symbol: string;
  name: string;
  exchange: string | null;
  currency: string | null;
}
export interface DailyBar {
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
export interface ForecastPoint {
  date: string;
  predictedValue: number;
  lowerBound?: number | null;
  upperBound?: number | null;
}
export interface ForecastResult {
  id: string;
  symbol: string;
  method: Method;
  horizon: Horizon;
  steps: number;
  lastObservedDate: string;
  lastObservedValue: number;
  points: ForecastPoint[];
  currency?: string;
  source?: string;
  trainingStartDate?: string;
  trainingEndDate?: string;
  generatedAt?: string;
  modelVersion?: string;
  metrics?: { available?: boolean; reason?: string; mae?: number; rmse?: number; windows?: number } | null;
}
