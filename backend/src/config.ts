import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "..", ".env"), override: false });
dotenv.config({ path: path.resolve(currentDirectory, "../../.env") });
dotenv.config({ path: path.resolve(currentDirectory, "../.env"), override: false });

const boolean = (value: string | undefined, fallback: boolean): boolean =>
  value === undefined ? fallback : value === "true";

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL,
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  forecastServiceUrl: (process.env.FORECAST_SERVICE_URL ?? "http://127.0.0.1:8000").replace("://localhost", "://127.0.0.1"),
  marketDataProvider: process.env.MARKET_DATA_PROVIDER ?? "alpha_vantage",
  alphaVantageApiKey: process.env.ALPHA_VANTAGE_API_KEY,
  fmpApiKey: process.env.FMP_API_KEY,
  useDatabase: boolean(process.env.USE_DATABASE, false),
  databasePoolMax: Number(process.env.DATABASE_POOL_MAX ?? 10),
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 10000)
};
