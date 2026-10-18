import { AppError } from "../errors.js";
import { config } from "../config.js";
import type { MarketDataProvider } from "../types.js";
import { AlphaVantageProvider } from "./alphaVantage.js";
import { FixtureProvider } from "./fixture.js";

export const createProvider = (): MarketDataProvider => {
  if (config.marketDataProvider === "fixture") return new FixtureProvider();
  if (config.marketDataProvider === "alpha_vantage" && config.alphaVantageApiKey && config.alphaVantageApiKey !== "replace_me") {
    return new AlphaVantageProvider(config.alphaVantageApiKey, config.requestTimeoutMs);
  }
  const unavailable = (): never => {
    throw new AppError("PROVIDER_NOT_CONFIGURED", "Configure MARKET_DATA_PROVIDER=fixture for local development or provide ALPHA_VANTAGE_API_KEY.", 503);
  };
  return { searchSymbols: unavailable, getLatestQuote: unavailable, getDailyHistory: unavailable };
};
