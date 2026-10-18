import { Pool } from "pg";
import type { DailyBar, Quote } from "../types.js";
import type { StoredForecast } from "./forecastRepository.js";
import { randomUUID } from "node:crypto";

export class PostgresRepository {
  readonly pool: Pool;
  constructor(connectionString: string, max: number) {
    this.pool = new Pool({ connectionString, max, connectionTimeoutMillis: 5000 });
  }

  async health(): Promise<void> {
    await this.pool.query("SELECT 1");
  }

  async saveBars(bars: DailyBar[]): Promise<void> {
    if (!bars.length) return;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO stocks(symbol, name, exchange, currency) VALUES ($1, $1, NULL, $2)
         ON CONFLICT (symbol) DO UPDATE SET currency = EXCLUDED.currency, updated_at = NOW()`,
        [bars[0].symbol, bars[0].currency]
      );
      for (const bar of bars) {
        await client.query(
          `INSERT INTO stock_prices(symbol, trading_date, open, high, low, close, adjusted_close, volume, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (symbol, trading_date, source) DO UPDATE SET
             open=EXCLUDED.open, high=EXCLUDED.high, low=EXCLUDED.low, close=EXCLUDED.close,
             adjusted_close=EXCLUDED.adjusted_close, volume=EXCLUDED.volume, fetched_at=NOW()`,
          [bar.symbol, bar.date, bar.open, bar.high, bar.low, bar.close, bar.adjustedClose, bar.volume, bar.source]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async saveQuote(quote: Quote): Promise<void> {
    await this.pool.query(
      `INSERT INTO stocks(symbol, name, exchange, currency) VALUES ($1, $1, $2, $3)
       ON CONFLICT (symbol) DO UPDATE SET exchange = EXCLUDED.exchange, currency = EXCLUDED.currency, updated_at = NOW()`,
      [quote.symbol, quote.exchange, quote.currency]
    );
    await this.pool.query(
      `INSERT INTO stock_quotes(symbol, price, currency, exchange, source, observed_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [quote.symbol, quote.price, quote.currency, quote.exchange, quote.source, quote.observedAt]
    );
  }

  async getBars(symbol: string, startDate?: string, endDate?: string): Promise<DailyBar[]> {
    const result = await this.pool.query(
      `SELECT symbol, trading_date::text AS date, open, high, low, close, adjusted_close, volume, source,
              COALESCE(s.currency, 'USD') AS currency
       FROM stock_prices p JOIN stocks s USING (symbol)
       WHERE symbol=$1 AND ($2::date IS NULL OR trading_date >= $2::date)
         AND ($3::date IS NULL OR trading_date <= $3::date)
       ORDER BY trading_date`,
      [symbol, startDate ?? null, endDate ?? null]
    );
    return result.rows.map((row) => ({
      symbol: row.symbol, date: row.date, open: Number(row.open), high: Number(row.high),
      low: Number(row.low), close: Number(row.close), adjustedClose: row.adjusted_close === null ? null : Number(row.adjusted_close),
      volume: row.volume === null ? null : Number(row.volume), currency: row.currency, source: row.source
    }));
  }

  async saveForecast(result: Record<string, unknown>): Promise<StoredForecast> {
    const id = randomUUID();
    const generatedAt = new Date().toISOString();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO forecast_runs
       (id, symbol, method, horizon, input_field, parameters, training_start_date, training_end_date, model_version, metrics, status, result)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'completed',$11)`,
        [id, result.symbol, result.method, result.horizon, result.priceField ?? "adjusted_close",
         JSON.stringify(result.parameters ?? {}), result.trainingStartDate, result.trainingEndDate, result.modelVersion ?? "1.0.0",
         result.metrics ? JSON.stringify(result.metrics) : null, JSON.stringify({ ...result, id })]
      );
      const points = Array.isArray(result.points) ? result.points as Array<Record<string, unknown>> : [];
      for (const point of points) {
        await client.query(
          `INSERT INTO forecast_points(forecast_run_id, forecast_date, predicted_value, lower_bound, upper_bound)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (forecast_run_id, forecast_date) DO UPDATE SET
           predicted_value=EXCLUDED.predicted_value, lower_bound=EXCLUDED.lower_bound, upper_bound=EXCLUDED.upper_bound`,
          [id, point.date, point.predictedValue, point.lowerBound ?? null, point.upperBound ?? null]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return { id, generatedAt, result: { ...result, id } };
  }

  async getForecast(id: string): Promise<StoredForecast | undefined> {
    const result = await this.pool.query("SELECT id, generated_at, result FROM forecast_runs WHERE id=$1", [id]);
    const row = result.rows[0];
    return row ? { id: row.id, generatedAt: row.generated_at.toISOString(), result: row.result } : undefined;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
