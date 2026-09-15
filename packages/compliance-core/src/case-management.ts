export type ComplianceCaseType =
  | "kyc_review"
  | "kyb_review"
  | "sanctions_review"
  | "risk_review"
  | "transaction_monitoring"
  | "manual_review";

export type ComplianceCasePriority = "low" | "normal" | "high" | "critical";

export type ComplianceCaseStatus = "open" | "investigating" | "escalated" | "resolved" | "closed";

export type ComplianceCaseAction = "start_investigation" | "escalate" | "resolve" | "close";

export interface ComplianceCase {
  id: string;
  subjectId?: string;
  caseType: ComplianceCaseType;
  priority: ComplianceCasePriority;
  status: ComplianceCaseStatus;
  reason: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface SuspiciousActivitySignal {
  subjectId?: string;
  transactionType: "deposit" | "withdrawal" | "trade" | "transfer";
  transactionId: string;
  ruleCode: string;
  riskScore: number;
  reason: string;
}

export interface ComplianceCaseTransition {
  caseId: string;
  action: ComplianceCaseAction;
  occurredAt: string;
  actor: string;
  reason: string;
}

export class ComplianceCaseManager {
  private readonly cases = new Map<string, ComplianceCase>();

  private readonly transitions = new Map<string, ComplianceCaseTransition[]>();

  create(caseRecord: ComplianceCase): ComplianceCase {
    if (this.cases.has(caseRecord.id)) {
      throw new Error(`Compliance case already exists: ${caseRecord.id}`);
    }

    this.validateCase(caseRecord);

    const stored = Object.freeze({
      ...caseRecord,
    });

    this.cases.set(caseRecord.id, stored);
    this.transitions.set(caseRecord.id, []);

    return stored;
  }

  getById(id: string): ComplianceCase | null {
    const caseRecord = this.cases.get(id);

    if (caseRecord === undefined) {
      return null;
    }

    return Object.freeze({
      ...caseRecord,
    });
  }

  startInvestigation(
    caseId: string,
    actor: string,
    occurredAt: string,
    reason: string,
  ): ComplianceCase {
    return this.transition(
      caseId,
      {
        action: "start_investigation",
        actor,
        occurredAt,
        reason,
      },
      (caseRecord) => {
        if (caseRecord.status !== "open") {
          throw new Error("Only open compliance cases can start investigation");
        }

        return {
          ...caseRecord,
          status: "investigating",
          updatedAt: occurredAt,
        };
      },
    );
  }

  escalate(caseId: string, actor: string, occurredAt: string, reason: string): ComplianceCase {
    return this.transition(
      caseId,
      {
        action: "escalate",
        actor,
        occurredAt,
        reason,
      },
      (caseRecord) => {
        if (caseRecord.status !== "open" && caseRecord.status !== "investigating") {
          throw new Error("Only open or investigating cases can be escalated");
        }

        return {
          ...caseRecord,
          status: "escalated",
          updatedAt: occurredAt,
        };
      },
    );
  }

  resolve(caseId: string, actor: string, occurredAt: string, reason: string): ComplianceCase {
    return this.transition(
      caseId,
      {
        action: "resolve",
        actor,
        occurredAt,
        reason,
      },
      (caseRecord) => {
        if (caseRecord.status !== "investigating" && caseRecord.status !== "escalated") {
          throw new Error("Only investigating or escalated cases can be resolved");
        }

        return {
          ...caseRecord,
          status: "resolved",
          updatedAt: occurredAt,
          resolvedAt: occurredAt,
        };
      },
    );
  }

  close(caseId: string, actor: string, occurredAt: string, reason: string): ComplianceCase {
    return this.transition(
      caseId,
      {
        action: "close",
        actor,
        occurredAt,
        reason,
      },
      (caseRecord) => {
        if (caseRecord.status !== "resolved") {
          throw new Error("Only resolved compliance cases can be closed");
        }

        return {
          ...caseRecord,
          status: "closed",
          updatedAt: occurredAt,
        };
      },
    );
  }

  getTransitions(caseId: string): readonly ComplianceCaseTransition[] {
    const transitions = this.transitions.get(caseId);

    if (transitions === undefined) {
      return [];
    }

    return Object.freeze(transitions.map((transition) => Object.freeze({ ...transition })));
  }

  createFromSuspiciousActivity(
    signal: SuspiciousActivitySignal,
    caseId: string,
    createdAt: string,
  ): ComplianceCase {
    if (signal.transactionId.trim().length === 0) {
      throw new Error("Transaction ID must not be empty");
    }

    if (signal.ruleCode.trim().length === 0) {
      throw new Error("Rule code must not be empty");
    }

    if (signal.reason.trim().length === 0) {
      throw new Error("Suspicious activity reason must not be empty");
    }

    if (signal.riskScore < 0 || signal.riskScore > 100) {
      throw new Error("Risk score must be between 0 and 100");
    }

    const priority: ComplianceCasePriority =
      signal.riskScore >= 80 ? "critical" : signal.riskScore >= 60 ? "high" : "normal";

    return this.create({
      id: caseId,
      ...(signal.subjectId !== undefined ? { subjectId: signal.subjectId } : {}),
      caseType: "transaction_monitoring",
      priority,
      status: "open",
      reason: signal.reason,
      createdAt,
      updatedAt: createdAt,
    });
  }

  private transition(
    caseId: string,
    transition: Omit<ComplianceCaseTransition, "caseId">,
    update: (caseRecord: ComplianceCase) => ComplianceCase,
  ): ComplianceCase {
    const existing = this.cases.get(caseId);

    if (existing === undefined) {
      throw new Error(`Compliance case not found: ${caseId}`);
    }

    this.validateTransition(transition);

    const updated = Object.freeze(update(existing));

    this.cases.set(caseId, updated);

    const history = this.transitions.get(caseId);

    if (history === undefined) {
      throw new Error(`Compliance case history not found: ${caseId}`);
    }

    history.push(
      Object.freeze({
        caseId,
        ...transition,
      }),
    );

    return updated;
  }

  private validateCase(caseRecord: ComplianceCase): void {
    if (caseRecord.id.trim().length === 0) {
      throw new Error("Compliance case ID must not be empty");
    }

    if (caseRecord.reason.trim().length === 0) {
      throw new Error("Compliance case reason must not be empty");
    }

    if (caseRecord.createdAt.trim().length === 0) {
      throw new Error("Compliance case createdAt must not be empty");
    }

    if (caseRecord.updatedAt.trim().length === 0) {
      throw new Error("Compliance case updatedAt must not be empty");
    }

    if (caseRecord.status === "resolved" || caseRecord.status === "closed") {
      if (caseRecord.resolvedAt === undefined) {
        throw new Error("Resolved and closed cases must have resolvedAt");
      }
    }
  }

  private validateTransition(transition: Omit<ComplianceCaseTransition, "caseId">): void {
    if (transition.actor.trim().length === 0) {
      throw new Error("Compliance case actor must not be empty");
    }

    if (transition.occurredAt.trim().length === 0) {
      throw new Error("Compliance case transition time must not be empty");
    }

    if (transition.reason.trim().length === 0) {
      throw new Error("Compliance case transition reason must not be empty");
    }
  }
}
