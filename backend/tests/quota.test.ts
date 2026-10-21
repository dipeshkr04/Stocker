import { describe, expect, it } from "vitest";
import { ProviderQuota } from "../src/providers/quota.js";

describe("provider quota", () => {
  it("rejects the sixth request in one minute", async () => {
    const quota = new ProviderQuota();
    await Promise.all(Array.from({ length: 5 }, () => quota.run(async () => undefined)));
    await expect(quota.run(async () => undefined)).rejects.toThrowError(/one minute/);
  });
});
