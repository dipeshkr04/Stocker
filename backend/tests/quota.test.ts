import { describe, expect, it } from "vitest";
import { ProviderQuota } from "../src/providers/quota.js";

describe("provider quota", () => {
  it("rejects the sixth request in one minute", () => {
    const quota = new ProviderQuota();
    for (let index = 0; index < 5; index += 1) quota.consume();
    expect(() => quota.consume()).toThrowError(/one minute/);
  });
});
