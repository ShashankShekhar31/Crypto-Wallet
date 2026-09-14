import type { OutboxPublisher } from "./outbox-publisher.js";

export interface OutboxWorkerOptions {
  intervalMs?: number;
}

export class OutboxWorker {
  private readonly intervalMs: number;
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private stopping = false;

  constructor(
    private readonly publisher: OutboxPublisher,
    options: OutboxWorkerOptions = {},
  ) {
    this.intervalMs = options.intervalMs ?? 1_000;
  }

  async start(): Promise<void> {
    if (this.timer !== undefined) {
      return;
    }

    this.stopping = false;

    await this.runOnce();

    this.timer = setInterval(() => {
      void this.runOnce();
    }, this.intervalMs);
  }

  async stop(): Promise<void> {
    this.stopping = true;

    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    while (this.running) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 10);
      });
    }
  }

  private async runOnce(): Promise<void> {
    if (this.running || this.stopping) {
      return;
    }

    this.running = true;

    try {
      await this.publisher.publishPending();
    } catch {
      // Individual event failures are handled by OutboxPublisher.
      // This protects the worker loop from unexpected batch-level failures.
    } finally {
      this.running = false;
    }
  }
}
