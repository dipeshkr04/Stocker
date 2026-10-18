import type { DailyBar, Quote } from "../types.js";

export class PriceRepository {
  private readonly history = new Map<string, DailyBar[]>();
  async saveBars(bars: DailyBar[]): Promise<void> {
    if (!bars.length) return;
    const existing = this.history.get(bars[0].symbol) ?? [];
    const merged = new Map([...existing, ...bars].map((bar) => [bar.date, bar]));
    this.history.set(bars[0].symbol, [...merged.values()].sort((a, b) => a.date.localeCompare(b.date)));
  }
  async getBars(symbol: string, startDate?: string, endDate?: string): Promise<DailyBar[]> {
    return (this.history.get(symbol) ?? []).filter((bar) => (!startDate || bar.date >= startDate) && (!endDate || bar.date <= endDate));
  }
  async saveQuote(_quote: Quote): Promise<void> {}
}
