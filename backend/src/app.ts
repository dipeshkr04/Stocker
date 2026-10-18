import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config.js";
import { errorResponse, AppError } from "./errors.js";
import { createProvider } from "./providers/index.js";
import { PriceRepository } from "./repositories/priceRepository.js";
import { MarketDataService } from "./services/marketData.js";
import { ForecastService } from "./services/forecast.js";
import { compareRequestSchema, forecastRequestSchema, historyRangeSchema, symbolSchema } from "./schemas.js";
import { PostgresRepository } from "./repositories/postgres.js";
import { randomUUID } from "node:crypto";

export const createApp = () => {
  const app = express();
  const database = config.useDatabase && config.databaseUrl ? new PostgresRepository(config.databaseUrl, config.databasePoolMax) : undefined;
  const market = new MarketDataService(createProvider(), database ?? new PriceRepository());
  const forecast = new ForecastService(database ? {
    save: (result) => database.saveForecast(result),
    get: (id) => database.getForecast(id)
  } : undefined);
  app.use(helmet());
  app.use(cors({ origin: config.frontendOrigin }));
  app.use(express.json({ limit: "100kb" }));
  const requestCounts: number[] = [];
  app.use((req, res, next) => {
    const now = Date.now();
    while (requestCounts[0] !== undefined && requestCounts[0] <= now - 60_000) requestCounts.shift();
    if (requestCounts.length >= 120) {
      res.status(429).json({ error: { code: "API_RATE_LIMITED", message: "Too many requests; retry after one minute." } });
      return;
    }
    requestCounts.push(now);
    const requestId = randomUUID();
    const startedAt = Date.now();
    res.setHeader("x-request-id", requestId);
    res.on("finish", () => {
      console.log(JSON.stringify({
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - startedAt
      }));
    });
    next();
  });
  app.get("/api/v1/health", async (_req, res, next) => {
    try {
      if (database) await database.health();
      res.json({ status: "ok", service: "backend", database: database ? "connected" : "in_memory" });
    } catch (error) { next(error); }
  });
  app.get("/api/v1/stocks/search", async (req, res, next) => {
    try {
      const query = String(req.query.q ?? "").trim();
      if (query.length < 1 || query.length > 30) throw new AppError("INVALID_QUERY", "Search query must contain 1-30 characters.");
      res.json({ results: await market.search(query) });
    } catch (error) { next(error); }
  });
  app.get("/api/v1/stocks/:symbol/quote", async (req, res, next) => {
    try { res.json(await market.quote(symbolSchema.parse(req.params.symbol))); } catch (error) { next(error); }
  });
  app.get("/api/v1/stocks/:symbol/history", async (req, res, next) => {
    try {
      const symbol = symbolSchema.parse(req.params.symbol);
      const range = historyRangeSchema.parse(req.query.range);
      const start = new Date(); start.setUTCDate(start.getUTCDate() - ({ "1d": 1, "5d": 7, "1m": 31, "3m": 93, "6m": 186, "1y": 366, "5y": 1826, max: 36500 }[range] ?? 366));
      const data = await market.history(symbol, start.toISOString().slice(0, 10));
      res.json({ symbol, range, bars: data, source: data[0]?.source ?? null, retrievedAt: new Date().toISOString() });
    } catch (error) { next(error); }
  });
  app.post("/api/v1/forecasts", async (req, res, next) => {
    try {
      const payload = forecastRequestSchema.parse(req.body);
      const history = await market.history(payload.symbol);
      res.json(await forecast.run(payload, history));
    } catch (error) { next(error); }
  });
  app.post("/api/v1/forecasts/compare", async (req, res, next) => {
    try {
      const payload = compareRequestSchema.parse(req.body);
      const history = await market.history(payload.symbol);
      res.json({ results: await forecast.compare(payload, history) });
    } catch (error) { next(error); }
  });
  app.get("/api/v1/forecasts/:id", async (req, res, next) => {
    try {
      const run = await forecast.get(req.params.id);
      if (!run) throw new AppError("FORECAST_NOT_FOUND", "Forecast run was not found.", 404);
      res.json({ ...run.result, generatedAt: run.generatedAt });
    } catch (error) { next(error); }
  });
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const result = errorResponse(error);
    res.status(result.status).json(result.body);
  });
  return app;
};

if (process.env.NODE_ENV !== "test") {
  const app = createApp();
  const server = app.listen(config.port, () => console.log(`Backend listening on port ${config.port}`));
  const shutdown = async () => {
    server.close();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
