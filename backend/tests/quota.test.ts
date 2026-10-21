import { describe, expect, it } from "vitest";
import { ProviderQuota } from "../src/providers/quota.js";

describe("provider quota", () => {
  it("rejects the sixth request in one minute", async () => {
    const quota = new ProviderQuota();
    await Promise.all(Array.from({ length: 5 }, () => quota.consume()));
    await expect(quota.consume()).rejects.toThrowError(/one minute/);
  });
});
