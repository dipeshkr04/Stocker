export interface StoredForecast {
  id: string;
  generatedAt: string;
  result: Record<string, unknown>;
}

export class ForecastRepository {
  private readonly runs = new Map<string, StoredForecast>();

  async save(result: Record<string, unknown>): Promise<StoredForecast> {
    const id = randomUUID();
    const run = { id, generatedAt: new Date().toISOString(), result: { ...result, id } };
    this.runs.set(id, run);
    return run;
  }

  async get(id: string): Promise<StoredForecast | undefined> {
    return this.runs.get(id);
  }
}
import { randomUUID } from "node:crypto";
