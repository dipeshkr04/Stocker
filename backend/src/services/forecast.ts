import { config } from "../config.js";
import { AppError } from "../errors.js";
import type { DailyBar } from "../types.js";
import { ForecastRepository } from "../repositories/forecastRepository.js";

export class ForecastService {
  constructor(private readonly repository: ForecastRepository | { save(result: Record<string, unknown>): Promise<{ result: Record<string, unknown> }>; get(id: string): Promise<{ result: Record<string, unknown>; generatedAt: string } | undefined> } = new ForecastRepository()) {}

  async run(payload: { symbol: string; method: string; horizon: string; priceField: string; parameters: Record<string, unknown> }, history: DailyBar[]) {
    if (history.length < 20) throw new AppError("INSUFFICIENT_HISTORY", "At least 20 observations are required.", 422);
    const response = await fetch(`${config.forecastServiceUrl}/internal/forecast`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, observations: history.map((bar) => ({ date: bar.date, value: payload.priceField === "close" ? bar.close : (bar.adjustedClose ?? bar.close) })) }),
      signal: AbortSignal.timeout(config.requestTimeoutMs)
    });
    if (!response.ok) {
      const body = await response.text();
      throw new AppError("FORECAST_SERVICE_ERROR", body || "Forecast service failed.", 502);
    }
    const result = await response.json() as Record<string, unknown>;
    const backtestResponse = await fetch(`${config.forecastServiceUrl}/internal/backtest`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: payload.symbol, method: payload.method, horizon: payload.horizon, parameters: payload.parameters, observations: history.map((bar) => ({ date: bar.date, value: payload.priceField === "close" ? bar.close : (bar.adjustedClose ?? bar.close) })) }),
      signal: AbortSignal.timeout(config.requestTimeoutMs)
    });
    if (!backtestResponse.ok) throw new AppError("BACKTEST_SERVICE_ERROR", "Forecast succeeded but historical evaluation failed.", 502);
    result.metrics = (await backtestResponse.json() as { metrics?: unknown }).metrics ?? null;
    result.priceField = payload.priceField;
    result.trainingStartDate = history[0].date;
    result.trainingEndDate = history.at(-1)!.date;
    result.currency = history[0].currency;
    result.source = history[0].source;
    result.modelVersion = result.modelVersion ?? "1.0.0";
    return (await this.repository.save(result)).result;
  }

  async compare(payload: { symbol: string; methods: string[]; horizon: string; priceField: string; parameters: Record<string, unknown> }, history: DailyBar[]) {
    return Promise.all(payload.methods.map((method) => this.run({ ...payload, method }, history)));
  }

  async get(id: string) {
    return this.repository.get(id);
  }
}
