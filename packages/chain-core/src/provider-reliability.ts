export type ProviderCircuitState = "closed" | "open" | "half-open";

export interface ProviderReliabilityOptions {
  /**
   * Maximum time allowed for a provider operation.
   */
  readonly timeoutMs: number;

  /**
   * Number of consecutive failures before opening the circuit.
   */
  readonly failureThreshold: number;

  /**
   * Time the circuit remains open before allowing a probe request.
   */
  readonly recoveryTimeoutMs: number;
}

export interface ProviderHealth {
  readonly id: string;
  readonly score: number;
  readonly consecutiveFailures: number;
  readonly circuitState: ProviderCircuitState;
  readonly totalRequests: number;
  readonly totalFailures: number;
  readonly lastSuccessAt?: number;
  readonly lastFailureAt?: number;
}

export interface ReliableProvider<TProvider> {
  readonly id: string;
  readonly provider: TProvider;
}

interface ProviderState<TProvider> {
  readonly id: string;
  readonly provider: TProvider;
  score: number;
  consecutiveFailures: number;
  circuitState: ProviderCircuitState;
  totalRequests: number;
  totalFailures: number;
  lastSuccessAt: number | undefined;
  lastFailureAt: number | undefined;
  openedAt: number | undefined;
}

const DEFAULT_OPTIONS: ProviderReliabilityOptions = Object.freeze({
  timeoutMs: 10_000,
  failureThreshold: 3,
  recoveryTimeoutMs: 30_000,
});

const MAX_HEALTH_SCORE = 100;
const MIN_HEALTH_SCORE = 0;
const SUCCESS_SCORE_INCREMENT = 10;
const FAILURE_SCORE_DECREMENT = 25;

export class ProviderReliabilityError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ProviderReliabilityError";
  }
}

export class ProviderPool<TProvider> {
  private readonly providers: ProviderState<TProvider>[];
  private readonly options: ProviderReliabilityOptions;

  constructor(
    providers: readonly ReliableProvider<TProvider>[],
    options: Partial<ProviderReliabilityOptions> = {},
  ) {
    if (providers.length === 0) {
      throw new Error("At least one provider is required");
    }

    this.options = validateOptions({
      ...DEFAULT_OPTIONS,
      ...options,
    });

    const ids = new Set<string>();

    this.providers = providers.map(({ id, provider }) => {
      const normalizedId = id.trim();

      if (!normalizedId) {
        throw new Error("Provider id is required");
      }

      if (ids.has(normalizedId)) {
        throw new Error(`Duplicate provider id: ${normalizedId}`);
      }

      ids.add(normalizedId);

      return {
        id: normalizedId,
        provider,
        score: MAX_HEALTH_SCORE,
        consecutiveFailures: 0,
        circuitState: "closed",
        totalRequests: 0,
        totalFailures: 0,
        lastSuccessAt: undefined,
        lastFailureAt: undefined,
        openedAt: undefined,
      };
    });
  }

  async execute<TResult>(operation: (provider: TProvider) => Promise<TResult>): Promise<TResult> {
    const errors: unknown[] = [];

    for (const state of this.getCandidateOrder()) {
      if (!this.isAvailable(state)) {
        continue;
      }

      const isHalfOpenProbe = state.circuitState === "half-open";

      state.totalRequests += 1;

      try {
        const result = await withTimeout(operation(state.provider), this.options.timeoutMs);

        this.recordSuccess(state);

        return result;
      } catch (error) {
        errors.push(error);
        this.recordFailure(state);

        if (isHalfOpenProbe) {
          state.circuitState = "open";
          state.openedAt = Date.now();
        }
      }
    }

    throw new ProviderReliabilityError("All RPC providers are unavailable", {
      cause: errors.length === 1 ? errors[0] : errors,
    });
  }

  getHealth(): readonly ProviderHealth[] {
    return Object.freeze(
      this.providers.map((state) =>
        Object.freeze({
          id: state.id,
          score: state.score,
          consecutiveFailures: state.consecutiveFailures,
          circuitState: state.circuitState,
          totalRequests: state.totalRequests,
          totalFailures: state.totalFailures,
          ...(state.lastSuccessAt === undefined ? {} : { lastSuccessAt: state.lastSuccessAt }),
          ...(state.lastFailureAt === undefined ? {} : { lastFailureAt: state.lastFailureAt }),
        }),
      ),
    );
  }

  private getCandidateOrder(): readonly ProviderState<TProvider>[] {
    return [...this.providers].sort((left, right) => {
      const leftAvailable = this.isAvailable(left);
      const rightAvailable = this.isAvailable(right);

      if (leftAvailable !== rightAvailable) {
        return leftAvailable ? -1 : 1;
      }

      if (left.score !== right.score) {
        return right.score - left.score;
      }

      return this.providers.indexOf(left) - this.providers.indexOf(right);
    });
  }

  private isAvailable(state: ProviderState<TProvider>): boolean {
    if (state.circuitState === "closed") {
      return true;
    }

    if (state.circuitState === "open") {
      const openedAt = state.openedAt;

      if (openedAt === undefined) {
        return false;
      }

      if (Date.now() - openedAt < this.options.recoveryTimeoutMs) {
        return false;
      }

      state.circuitState = "half-open";
      return true;
    }

    return true;
  }

  private recordSuccess(state: ProviderState<TProvider>): void {
    state.consecutiveFailures = 0;
    state.score = Math.min(MAX_HEALTH_SCORE, state.score + SUCCESS_SCORE_INCREMENT);
    state.circuitState = "closed";
    state.openedAt = undefined;
    state.lastSuccessAt = Date.now();
  }

  private recordFailure(state: ProviderState<TProvider>): void {
    state.totalFailures += 1;
    state.consecutiveFailures += 1;
    state.score = Math.max(MIN_HEALTH_SCORE, state.score - FAILURE_SCORE_DECREMENT);
    state.lastFailureAt = Date.now();

    if (state.consecutiveFailures >= this.options.failureThreshold) {
      state.circuitState = "open";
      state.openedAt = Date.now();
    }
  }
}

function validateOptions(options: ProviderReliabilityOptions): ProviderReliabilityOptions {
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error("Provider timeout must be positive");
  }

  if (!Number.isInteger(options.failureThreshold) || options.failureThreshold <= 0) {
    throw new Error("Provider failure threshold must be a positive integer");
  }

  if (!Number.isFinite(options.recoveryTimeoutMs) || options.recoveryTimeoutMs <= 0) {
    throw new Error("Provider recovery timeout must be positive");
  }

  return Object.freeze({ ...options });
}

interface TimerApi {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

const timerApi = globalThis as unknown as TimerApi;

async function withTimeout<TResult>(
  promise: Promise<TResult>,
  timeoutMs: number,
): Promise<TResult> {
  let timeoutHandle: unknown;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = timerApi.setTimeout(() => {
      reject(new Error(`Provider request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle !== undefined) {
      timerApi.clearTimeout(timeoutHandle);
    }
  }
}
