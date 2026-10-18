import { AppError } from "../errors.js";

export class ProviderQuota {
  private readonly minuteRequests: number[] = [];
  private readonly dayRequests: number[] = [];

  consume(): void {
    const now = Date.now();
    this.prune(this.minuteRequests, now - 60_000);
    this.prune(this.dayRequests, now - 86_400_000);
    if (this.minuteRequests.length >= 5) {
      throw new AppError("PROVIDER_RATE_LIMITED", "Provider request limit reached; retry after one minute.", 429);
    }
    if (this.dayRequests.length >= 25) {
      throw new AppError("PROVIDER_DAILY_LIMITED", "Provider daily request limit reached; retry tomorrow.", 429);
    }
    this.minuteRequests.push(now);
    this.dayRequests.push(now);
  }

  private prune(requests: number[], cutoff: number): void {
    while (requests[0] !== undefined && requests[0] <= cutoff) requests.shift();
  }
}
