import type { DailyBar, MarketDataProvider, Quote, SymbolResult } from "../types.js";

const bars = (symbol: string): DailyBar[] => Array.from({ length: 260 }, (_, index) => {
  const date = new Date(Date.UTC(2025, 0, 2 + index));
  const value = 100 + index * 0.08 + Math.sin(index / 8) * 2;
  return {
    symbol, date: date.toISOString().slice(0, 10), open: value - 0.5, high: value + 1,
    low: value - 1, close: Number(value.toFixed(4)), adjustedClose: Number(value.toFixed(4)),
    volume: 1000000 + index, currency: "USD", source: "fixture"
  };
}).filter((bar) => new Date(`${bar.date}T00:00:00Z`).getUTCDay() !== 0 && new Date(`${bar.date}T00:00:00Z`).getUTCDay() !== 6);

export class FixtureProvider implements MarketDataProvider {
  async searchSymbols(query: string): Promise<SymbolResult[]> {
    const symbols = [{ symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", currency: "USD" }, { symbol: "MSFT", name: "Microsoft Corporation", exchange: "NASDAQ", currency: "USD" }];
    return symbols.filter((item) => item.symbol.includes(query.toUpperCase()) || item.name.toUpperCase().includes(query.toUpperCase()));
  }
  async getLatestQuote(symbol: string): Promise<Quote> {
    const history = await this.getDailyHistory(symbol);
    const last = history.at(-1);
    if (!last) throw new Error(`No fixture data for ${symbol}`);
    return { symbol, price: last.close, currency: last.currency, exchange: "NASDAQ", source: "fixture", observedAt: `${last.date}T21:00:00Z`, freshness: "latest_available" };
  }
  async getDailyHistory(symbol: string, startDate?: string, endDate?: string): Promise<DailyBar[]> {
    return bars(symbol).filter((bar) => (!startDate || bar.date >= startDate) && (!endDate || bar.date <= endDate));
  }
}
