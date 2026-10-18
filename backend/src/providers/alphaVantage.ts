import { AppError } from "../errors.js";
import { ProviderQuota } from "./quota.js";
import type { DailyBar, MarketDataProvider, Quote, SymbolResult } from "../types.js";

const endpoint = "https://www.alphavantage.co/query";
const number = (value: string | undefined): number | null => value === undefined ? null : Number(value);
const request = async (params: Record<string, string>, timeoutMs: number): Promise<Record<string, unknown>> => {
  const url = new URL(endpoint);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new AppError("PROVIDER_HTTP_ERROR", `Market data provider returned HTTP ${response.status}`, 502);
  const data = await response.json() as Record<string, unknown>;
  if (typeof data["Note"] === "string") throw new AppError("PROVIDER_QUOTA_EXCEEDED", "Market data provider quota exceeded; retry later.", 429);
  if (typeof data["Information"] === "string") throw new AppError("PROVIDER_QUOTA_EXCEEDED", data["Information"], 429);
  if (typeof data["Error Message"] === "string") throw new AppError("PROVIDER_ERROR", data["Error Message"], 502);
  return data;
};

export class AlphaVantageProvider implements MarketDataProvider {
  constructor(private readonly apiKey: string, private readonly timeoutMs: number, private readonly quota = new ProviderQuota()) {}
  async searchSymbols(query: string): Promise<SymbolResult[]> {
    this.quota.consume();
    const data = await request({ function: "SYMBOL_SEARCH", keywords: query, apikey: this.apiKey }, this.timeoutMs);
    const matches = Array.isArray(data.bestMatches) ? data.bestMatches : [];
    return matches.map((item) => {
      const value = item as Record<string, string>;
      return { symbol: value["1. symbol"], name: value["2. name"], exchange: value["4. region"] ?? null, currency: value["8. currency"] ?? null };
    }).filter((item) => Boolean(item.symbol));
  }
  async getLatestQuote(symbol: string): Promise<Quote> {
    this.quota.consume();
    const data = await request({ function: "GLOBAL_QUOTE", symbol, apikey: this.apiKey }, this.timeoutMs);
    const quote = data["Global Quote"] as Record<string, string> | undefined;
    if (!quote?.["05. price"]) throw new AppError("PROVIDER_EMPTY", `No quote found for ${symbol}`, 404);
    return { symbol, price: Number(quote["05. price"]), currency: "USD", exchange: null, source: "alpha_vantage", observedAt: `${quote["07. latest trading day"]}T00:00:00Z`, freshness: "latest_available" };
  }
  async getDailyHistory(symbol: string, startDate?: string, endDate?: string): Promise<DailyBar[]> {
    this.quota.consume();
    const data = await request({ function: "TIME_SERIES_DAILY", symbol, outputsize: "compact", apikey: this.apiKey }, this.timeoutMs);
    const series = data["Time Series (Daily)"] as Record<string, Record<string, string>> | undefined;
    if (!series) throw new AppError("PROVIDER_EMPTY", `No history found for ${symbol}`, 404);
    return Object.entries(series).map(([date, item]) => ({
      symbol, date, open: Number(item["1. open"]), high: Number(item["2. high"]), low: Number(item["3. low"]),
      close: Number(item["4. close"]), adjustedClose: null, volume: number(item["5. volume"]),
      currency: "USD", source: "alpha_vantage"
    })).filter((bar) => (!startDate || bar.date >= startDate) && (!endDate || bar.date <= endDate)).sort((a, b) => a.date.localeCompare(b.date));
  }
}
