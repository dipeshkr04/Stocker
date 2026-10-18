import { z } from "zod";

export const methods = [
  "mean",
  "moving_average",
  "exponential_smoothing",
  "trend_projection",
  "linear_regression",
  "arima"
] as const;
export const horizons = ["1d", "1w", "1m", "6m", "1y"] as const;
export const forecastRequestSchema = z.object({
  symbol: z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9.-]+$/).transform((v) => v.toUpperCase()),
  method: z.enum(methods),
  horizon: z.enum(horizons),
  priceField: z.enum(["close", "adjusted_close"]).default("adjusted_close"),
  parameters: z.record(z.unknown()).default({})
});
export const compareRequestSchema = forecastRequestSchema.extend({
  methods: z.array(z.enum(methods)).min(1).max(6)
}).omit({ method: true });
export const historyRangeSchema = z.enum(["1d", "5d", "1m", "3m", "6m", "1y", "5y", "max"]).default("1y");
export const symbolSchema = z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9.-]+$/).transform((v) => v.toUpperCase());
