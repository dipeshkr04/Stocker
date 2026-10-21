import { AppError } from "../errors.js";
import { config } from "../config.js";
import type { MarketDataProvider } from "../types.js";
import { AlphaVantageProvider } from "./alphaVantage.js";
import { FixtureProvider } from "./fixture.js";
import { FmpProvider } from "./fmp.js";

export const createProvider = (): MarketDataProvider => {
  if (config.marketDataProvider === "fixture") return new FixtureProvider();
  if (config.marketDataProvider === "fmp" && config.fmpApiKey && config.fmpApiKey !== "replace_me") {
    return new FmpProvider(config.fmpApiKey, config.requestTimeoutMs);
  }
  if (config.marketDataProvider === "alpha_vantage" && config.alphaVantageApiKey && config.alphaVantageApiKey !== "replace_me") {
    return new AlphaVantageProvider(config.alphaVantageApiKey, config.requestTimeoutMs);
  }
  const unavailable = (): never => {
    throw new AppError("PROVIDER_NOT_CONFIGURED", "Configure MARKET_DATA_PROVIDER=fixture, provide FMP_API_KEY with MARKET_DATA_PROVIDER=fmp, or provide ALPHA_VANTAGE_API_KEY with MARKET_DATA_PROVIDER=alpha_vantage.", 503);
  };
  return { searchSymbols: unavailable, getLatestQuote: unavailable, getDailyHistory: unavailable };
};
