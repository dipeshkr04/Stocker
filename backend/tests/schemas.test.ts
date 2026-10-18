import { describe, expect, it } from "vitest";
import { compareRequestSchema, forecastRequestSchema } from "../src/schemas.js";

describe("forecast request validation", () => {
  it("normalizes symbols and accepts only supported identifiers", () => {
    const result = forecastRequestSchema.parse({ symbol: "aapl", method: "mean", horizon: "1m" });
    expect(result.symbol).toBe("AAPL");
    expect(() => forecastRequestSchema.parse({ symbol: "AAPL", method: "unknown", horizon: "1m" })).toThrow();
  });

  it("bounds comparison methods", () => {
    expect(compareRequestSchema.parse({ symbol: "AAPL", methods: ["mean", "arima"], horizon: "1d" }).methods).toHaveLength(2);
    expect(() => compareRequestSchema.parse({ symbol: "AAPL", methods: [], horizon: "1d" })).toThrow();
  });
});
