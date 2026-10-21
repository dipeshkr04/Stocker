import { AppError } from "../errors.js";
import { ProviderQuota } from "./quota.js";
import type { DailyBar, MarketDataProvider, Quote, SymbolResult } from "../types.js";

const endpoint = "https://financialmodelingprep.com/stable";
const providerErrorMessage = "Market data provider request failed.";
const providerRateLimitMessage = "API rate limit reached. Please try again later.";

const request = async (path: string, params: Record<string, string>, timeoutMs: number): Promise<unknown> => {
  const url = new URL(`${endpoint}/${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  const data = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    if (response.status === 429) throw new AppError("PROVIDER_QUOTA_EXCEEDED", providerRateLimitMessage, 429);
    throw new AppError("PROVIDER_ERROR", providerErrorMessage, 502);
  }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const body = data as Record<string, unknown>;
    if (typeof body["Error Message"] === "string" || typeof body["error"] === "string") {
      throw new AppError("PROVIDER_ERROR", providerErrorMessage, 502);
    }
  }
  return data;
};

const asArray = (data: unknown): Record<string, unknown>[] =>
  Array.isArray(data) ? data.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : [];

const text = (value: unknown): string | null => typeof value === "string" && value ? value : null;
const numeric = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value ? Number(value) : null;
const sixMonthsAgo = (): string => {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() - 6);
  return date.toISOString().slice(0, 10);
};
const observedDate = (value: unknown): string => {
  if (typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value))) {
    return new Date(Number(value) * 1000).toISOString();
  }
  return text(value) ?? new Date().toISOString();
};

export class FmpProvider implements MarketDataProvider {
  readonly source = "fmp";
  constructor(private readonly apiKey: string, private readonly timeoutMs: number, private readonly quota = new ProviderQuota()) {}

  async searchSymbols(query: string): Promise<SymbolResult[]> {
    const endpointName = query === query.toUpperCase() && /^[A-Z0-9.-]+$/.test(query) ? "search-symbol" : "search-name";
    const data = await this.quota.run(() => request(endpointName, { query, apikey: this.apiKey }, this.timeoutMs));
    return asArray(data).map((item) => ({
      symbol: text(item.symbol) ?? "",
      name: text(item.name) ?? text(item.companyName) ?? "",
      exchange: text(item.exchangeShortName) ?? text(item.exchange) ?? null,
      currency: text(item.currency) ?? null
    })).filter((item) => Boolean(item.symbol));
  }

  async getLatestQuote(symbol: string): Promise<Quote> {
    const data = await this.quota.run(() => request("quote", { symbol, apikey: this.apiKey }, this.timeoutMs));
    const item = asArray(data)[0];
    const price = numeric(item?.price);
    if (!item || price === null) throw new AppError("PROVIDER_EMPTY", `No quote found for ${symbol}`, 404);
    return {
      symbol,
      price,
      currency: text(item.currency) ?? "USD",
      exchange: text(item.exchange) ?? null,
      source: "fmp",
      observedAt: observedDate(item.timestamp),
      freshness: "latest_available"
    };
  }

  async getDailyHistory(symbol: string, startDate?: string, endDate?: string): Promise<DailyBar[]> {
    const minimumStartDate = sixMonthsAgo();
    const requestedStartDate = startDate && startDate > minimumStartDate ? startDate : minimumStartDate;
    const params: Record<string, string> = { symbol, from: requestedStartDate, apikey: this.apiKey };
    if (endDate) params.to = endDate;
    const data = await this.quota.run(() => request("historical-price-eod/full", params, this.timeoutMs));
    const bars = asArray(data).map((item) => ({
      symbol,
      date: text(item.date) ?? "",
      open: numeric(item.open) ?? 0,
      high: numeric(item.high) ?? 0,
      low: numeric(item.low) ?? 0,
      close: numeric(item.close) ?? 0,
      adjustedClose: numeric(item.adjClose) ?? numeric(item.adjustedClose),
      volume: numeric(item.volume),
      currency: "USD",
      source: "fmp"
    })).filter((bar) => Boolean(bar.date));
    if (!bars.length) throw new AppError("PROVIDER_EMPTY", `No history found for ${symbol}`, 404);
    return bars.sort((a, b) => a.date.localeCompare(b.date));
  }
}
