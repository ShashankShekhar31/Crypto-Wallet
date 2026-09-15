import type {
  ScreeningObservation,
  ScreeningRequest,
  ScreeningStatus,
  ScreeningType,
  TransactionMonitoringContext,
} from "./types.js";

export interface ComplianceScreeningProvider {
  readonly name: string;

  screen(request: ScreeningRequest): Promise<ScreeningObservation>;
}

export interface TransactionMonitoringProvider {
  readonly name: string;

  evaluate(context: TransactionMonitoringContext): Promise<TransactionMonitoringDecision>;
}

export interface TransactionMonitoringDecision {
  status: "clear" | "review" | "blocked";
  riskScore: number;
  ruleCodes: readonly string[];
  reason: string;
}

export class ScreeningService {
  private readonly providers = new Map<ScreeningType, ComplianceScreeningProvider>();

  register(screeningType: ScreeningType, provider: ComplianceScreeningProvider): void {
    if (this.providers.has(screeningType)) {
      throw new Error(`Screening provider already registered for ${screeningType}`);
    }

    this.providers.set(screeningType, provider);
  }

  async screen(request: ScreeningRequest): Promise<ScreeningObservation> {
    const provider = this.providers.get(request.screeningType);

    if (provider === undefined) {
      throw new Error(`No screening provider registered for ${request.screeningType}`);
    }

    const observation = await provider.screen(request);

    this.validateObservation(observation);

    return Object.freeze({ ...observation });
  }

  private validateObservation(observation: ScreeningObservation): void {
    if (observation.provider.trim().length === 0) {
      throw new Error("Screening provider must not be empty");
    }

    if (observation.providerReference !== undefined) {
      if (observation.providerReference.trim().length === 0) {
        throw new Error("Screening provider reference must not be empty");
      }
    }

    if (observation.screenedAt.trim().length === 0) {
      throw new Error("Screening timestamp must not be empty");
    }

    const validStatuses: readonly ScreeningStatus[] = [
      "pending",
      "clear",
      "match",
      "review",
      "failed",
    ];

    if (!validStatuses.includes(observation.status)) {
      throw new Error(`Invalid screening status: ${observation.status}`);
    }
  }
}

export class TransactionMonitoringService {
  private readonly providers: TransactionMonitoringProvider[] = [];

  register(provider: TransactionMonitoringProvider): void {
    this.providers.push(provider);
  }

  async evaluate(context: TransactionMonitoringContext): Promise<TransactionMonitoringDecision[]> {
    if (this.providers.length === 0) {
      throw new Error("No transaction monitoring provider registered");
    }

    const decisions = await Promise.all(
      this.providers.map((provider) => provider.evaluate(context)),
    );

    for (const decision of decisions) {
      if (decision.riskScore < 0 || decision.riskScore > 100) {
        throw new Error("Transaction monitoring risk score must be 0-100");
      }

      if (decision.reason.trim().length === 0) {
        throw new Error("Transaction monitoring reason must not be empty");
      }
    }

    return decisions.map((decision) => Object.freeze({ ...decision }));
  }
}
