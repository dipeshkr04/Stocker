import { AppError } from "../errors.js";

export class ProviderQuota {
  private readonly minuteRequests: number[] = [];
  private readonly dayRequests: number[] = [];
  private nextRequestAt = 0;
  private requestQueue: Promise<void> = Promise.resolve();

  run<T>(operation: () => Promise<T>): Promise<T> {
    const request = this.requestQueue.then(async () => {
      const now = Date.now();
      this.prune(this.minuteRequests, now - 60_000);
      this.prune(this.dayRequests, now - 86_400_000);
      if (this.minuteRequests.length >= 5) {
        throw new AppError("PROVIDER_RATE_LIMITED", "Provider request limit reached; retry after one minute.", 429);
      }
      if (this.dayRequests.length >= 25) {
        throw new AppError("PROVIDER_DAILY_LIMITED", "Provider daily request limit reached; retry tomorrow.", 429);
      }

      const waitMs = Math.max(0, this.nextRequestAt - now);
      if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
      const sentAt = Date.now();
      this.nextRequestAt = sentAt + 1_000;
      this.minuteRequests.push(sentAt);
      this.dayRequests.push(sentAt);
      return operation();
    });
    this.requestQueue = request.then(() => undefined, () => undefined);
    return request;
  }

  private prune(requests: number[], cutoff: number): void {
    while (requests[0] !== undefined && requests[0] <= cutoff) requests.shift();
  }
}
