import type { DailyBar, ForecastResult, Horizon, Method, Quote, SymbolResult } from "../types";

const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(path, { headers: { "content-type": "application/json" }, ...options });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
};

export const api = {
  search: (query: string, signal?: AbortSignal) => request<{ results: SymbolResult[] }>(`/api/v1/stocks/search?q=${encodeURIComponent(query)}`, { signal }),
  quote: (symbol: string) => request<Quote>(`/api/v1/stocks/${encodeURIComponent(symbol)}/quote`),
  history: (symbol: string, range = "1y") => request<{ bars: DailyBar[]; range: string }>(`/api/v1/stocks/${encodeURIComponent(symbol)}/history?range=${range}`),
  forecast: (symbol: string, method: Method, horizon: Horizon, parameters: Record<string, unknown> = {}) =>
    request<ForecastResult>("/api/v1/forecasts", {
      method: "POST",
      body: JSON.stringify({ symbol, method, horizon, priceField: "adjusted_close", parameters })
    }),
  compare: (symbol: string, methods: Method[], horizon: Horizon) =>
    request<{ results: ForecastResult[] }>("/api/v1/forecasts/compare", {
      method: "POST",
      body: JSON.stringify({ symbol, methods, horizon, priceField: "adjusted_close", parameters: {} })
    })
};
