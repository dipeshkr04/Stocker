import { AppError } from "../errors.js";
import type { DailyBar, MarketDataProvider, QuoteStore } from "../types.js";

export interface PriceStore {
  getBars(symbol: string, startDate?: string, endDate?: string): Promise<DailyBar[]>;
  saveBars(bars: DailyBar[]): Promise<void>;
}

export class MarketDataService {
  private readonly quotes = new Map<string, { expiresAt: number; value: Awaited<ReturnType<MarketDataProvider["getLatestQuote"]>> }>();
  private readonly quoteRequests = new Map<string, Promise<Awaited<ReturnType<MarketDataProvider["getLatestQuote"]>>>>();
  private readonly historyRequests = new Map<string, Promise<DailyBar[]>>();
  constructor(private readonly provider: MarketDataProvider, private readonly repository: PriceStore & QuoteStore) {}
  search(query: string) { return this.provider.searchSymbols(query); }
  async quote(symbol: string) {
    const cached = this.quotes.get(symbol);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const inFlight = this.quoteRequests.get(symbol);
    if (inFlight) return inFlight;
    const request = (async () => {
      const value = await this.provider.getLatestQuote(symbol);
      await this.repository.saveQuote(value);
      this.quotes.set(symbol, { value, expiresAt: Date.now() + 60_000 });
      return value;
    })();
    this.quoteRequests.set(symbol, request);
    try {
      return await request;
    } finally {
      this.quoteRequests.delete(symbol);
    }
  }
  async history(symbol: string, startDate?: string, endDate?: string) {
    const requestKey = `${symbol}:${startDate ?? ""}:${endDate ?? ""}`;
    const inFlight = this.historyRequests.get(requestKey);
    if (inFlight) return inFlight;
    const request = this.loadHistory(symbol, startDate, endDate);
    this.historyRequests.set(requestKey, request);
    try {
      return await request;
    } finally {
      this.historyRequests.delete(requestKey);
    }
  }
  private async loadHistory(symbol: string, startDate?: string, endDate?: string) {
    const allCached = await this.repository.getBars(symbol);
    const coversStart = !startDate || (allCached[0]?.date !== undefined && allCached[0].date <= startDate);
    const coversEnd = !endDate || (allCached.at(-1)?.date !== undefined && allCached.at(-1)!.date >= endDate);
    if (allCached.length && coversStart && coversEnd) {
      return allCached.filter((bar) => (!startDate || bar.date >= startDate) && (!endDate || bar.date <= endDate));
    }
    const fetched = await this.provider.getDailyHistory(symbol, startDate, endDate);
    if (!fetched.length) throw new AppError("NO_HISTORY", `No history found for ${symbol}`, 404);
    await this.repository.saveBars(fetched);
    return fetched;
  }
}
