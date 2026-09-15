import { describe, expect, it } from "vitest";

import { ScreeningService, TransactionMonitoringService } from "../screening.js";

import { calculateRiskAssessment } from "../risk-scoring.js";

import { validateTravelRuleTransfer } from "../travel-rule.js";

import { ComplianceCaseManager } from "../case-management.js";

describe("ScreeningService", () => {
  it("registers and executes a screening provider", async () => {
    const service = new ScreeningService();

    service.register("sanctions", {
      name: "test-provider",
      async screen() {
        return {
          screeningType: "sanctions",
          status: "clear",
          provider: "test-provider",
          providerReference: "screen-001",
          screenedAt: "2026-09-15T10:00:00Z",
        };
      },
    });

    const result = await service.screen({
      subjectId: "subject-1",
      screeningType: "sanctions",
      reference: "request-001",
    });

    expect(result.status).toBe("clear");
    expect(result.provider).toBe("test-provider");
  });

  it("rejects duplicate providers for the same screening type", () => {
    const service = new ScreeningService();

    const provider = {
      name: "provider-a",
      async screen() {
        return {
          screeningType: "kyc" as const,
          status: "clear" as const,
          provider: "provider-a",
          screenedAt: "2026-09-15T10:00:00Z",
        };
      },
    };

    service.register("kyc", provider);

    expect(() => service.register("kyc", provider)).toThrow(
      "Screening provider already registered for kyc",
    );
  });

  it("rejects screening when no provider is registered", async () => {
    const service = new ScreeningService();

    await expect(
      service.screen({
        subjectId: "subject-1",
        screeningType: "pep",
        reference: "request-001",
      }),
    ).rejects.toThrow("No screening provider registered for pep");
  });

  it("rejects an invalid screening observation", async () => {
    const service = new ScreeningService();

    service.register("sanctions", {
      name: "test-provider",
      async screen() {
        return {
          screeningType: "sanctions",
          status: "clear",
          provider: "",
          screenedAt: "2026-09-15T10:00:00Z",
        };
      },
    });

    await expect(
      service.screen({
        subjectId: "subject-1",
        screeningType: "sanctions",
        reference: "request-001",
      }),
    ).rejects.toThrow("Screening provider must not be empty");
  });
});

describe("TransactionMonitoringService", () => {
  it("evaluates all registered providers", async () => {
    const service = new TransactionMonitoringService();

    service.register({
      name: "rule-provider-a",
      async evaluate() {
        return {
          status: "clear",
          riskScore: 10,
          ruleCodes: ["LOW_ACTIVITY"],
          reason: "No suspicious activity detected",
        };
      },
    });

    service.register({
      name: "rule-provider-b",
      async evaluate() {
        return {
          status: "review",
          riskScore: 65,
          ruleCodes: ["VELOCITY"],
          reason: "High transaction velocity",
        };
      },
    });

    const results = await service.evaluate({
      subjectId: "subject-1",
      transactionType: "withdrawal",
      transactionId: "tx-1",
      amount: "100000",
      assetId: "asset-1",
      occurredAt: "2026-09-15T10:00:00Z",
    });

    expect(results).toHaveLength(2);
    expect(results[0]?.status).toBe("clear");
    expect(results[1]?.status).toBe("review");
  });

  it("rejects transaction monitoring without providers", async () => {
    const service = new TransactionMonitoringService();

    await expect(
      service.evaluate({
        transactionType: "withdrawal",
        transactionId: "tx-1",
        amount: "100",
        assetId: "asset-1",
        occurredAt: "2026-09-15T10:00:00Z",
      }),
    ).rejects.toThrow("No transaction monitoring provider registered");
  });

  it("rejects a risk score outside 0-100", async () => {
    const service = new TransactionMonitoringService();

    service.register({
      name: "bad-provider",
      async evaluate() {
        return {
          status: "review",
          riskScore: 101,
          ruleCodes: ["BAD_SCORE"],
          reason: "Invalid score",
        };
      },
    });

    await expect(
      service.evaluate({
        transactionType: "trade",
        transactionId: "tx-1",
        amount: "100",
        assetId: "asset-1",
        occurredAt: "2026-09-15T10:00:00Z",
      }),
    ).rejects.toThrow("Transaction monitoring risk score must be 0-100");
  });
});

describe("calculateRiskAssessment", () => {
  const safeInput = {
    account: {
      accountAgeDays: 365,
      priorComplianceReviews: 0,
      priorAlerts: 0,
    },
    device: {
      known: true,
      recentDeviceChanges: 0,
      failedAuthenticationAttempts: 0,
    },
    withdrawal: {
      amount: "1000",
      recentWithdrawalCount: 0,
      newDestination: false,
      recentlyChangedSecuritySettings: false,
    },
    transaction: {
      amount: "1000",
      velocityCount: 1,
      velocityWindowMinutes: 60,
      unusualAsset: false,
      unusualNetwork: false,
    },
  };

  it("returns low risk for normal behavior", () => {
    const result = calculateRiskAssessment(safeInput);

    expect(result.score).toBe(0);
    expect(result.riskLevel).toBe("low");
    expect(result.factors).toHaveLength(0);
  });

  it("adds account and device risk factors", () => {
    const result = calculateRiskAssessment({
      ...safeInput,
      account: {
        accountAgeDays: 2,
        priorComplianceReviews: 2,
        priorAlerts: 2,
      },
      device: {
        known: false,
        recentDeviceChanges: 1,
        failedAuthenticationAttempts: 2,
      },
    });

    expect(result.factors.map((factor) => factor.code)).toEqual([
      "NEW_ACCOUNT",
      "PRIOR_COMPLIANCE_REVIEW",
      "PRIOR_ALERTS",
      "UNKNOWN_DEVICE",
      "RECENT_DEVICE_CHANGE",
      "FAILED_AUTHENTICATION",
    ]);

    expect(result.score).toBe(66);
    expect(result.riskLevel).toBe("high");
  });

  it("adds withdrawal risk factors", () => {
    const result = calculateRiskAssessment({
      ...safeInput,
      withdrawal: {
        amount: "50000",
        recentWithdrawalCount: 5,
        newDestination: true,
        recentlyChangedSecuritySettings: true,
      },
    });

    expect(result.factors.map((factor) => factor.code)).toEqual([
      "WITHDRAWAL_VELOCITY",
      "NEW_DESTINATION",
      "RECENT_SECURITY_CHANGE",
    ]);

    expect(result.score).toBe(60);
    expect(result.riskLevel).toBe("high");
  });

  it("adds transaction risk factors", () => {
    const result = calculateRiskAssessment({
      ...safeInput,
      transaction: {
        amount: "50000",
        velocityCount: 10,
        velocityWindowMinutes: 60,
        unusualAsset: true,
        unusualNetwork: true,
      },
    });

    expect(result.score).toBe(40);
    expect(result.riskLevel).toBe("medium");
  });

  it("caps risk score at 100", () => {
    const result = calculateRiskAssessment({
      account: {
        accountAgeDays: 1,
        priorComplianceReviews: 10,
        priorAlerts: 10,
      },
      device: {
        known: false,
        recentDeviceChanges: 10,
        failedAuthenticationAttempts: 10,
      },
      withdrawal: {
        amount: "100",
        recentWithdrawalCount: 10,
        newDestination: true,
        recentlyChangedSecuritySettings: true,
      },
      transaction: {
        amount: "100",
        velocityCount: 10,
        velocityWindowMinutes: 10,
        unusualAsset: true,
        unusualNetwork: true,
      },
    });

    expect(result.score).toBe(100);
    expect(result.riskLevel).toBe("critical");
  });

  it("rejects invalid withdrawal amounts", () => {
    expect(() =>
      calculateRiskAssessment({
        ...safeInput,
        withdrawal: {
          ...safeInput.withdrawal,
          amount: "1.5",
        },
      }),
    ).toThrow("Withdrawal amount must be a non-negative integer string");
  });

  it("rejects invalid transaction amounts", () => {
    expect(() =>
      calculateRiskAssessment({
        ...safeInput,
        transaction: {
          ...safeInput.transaction,
          amount: "-1",
        },
      }),
    ).toThrow("Transaction amount must be a non-negative integer string");
  });
});

describe("validateTravelRuleTransfer", () => {
  const validTransfer = {
    transferId: "transfer-1",
    assetId: "asset-1",
    networkId: "network-1",
    amount: "100000",
    originator: {
      type: "individual" as const,
      name: "Alice",
      accountIdentifier: "originator-account",
    },
    beneficiary: {
      type: "business" as const,
      name: "Bob Corp",
      accountIdentifier: "beneficiary-account",
    },
    createdAt: "2026-09-15T10:00:00Z",
  };

  it("accepts a complete Travel Rule transfer", () => {
    const result = validateTravelRuleTransfer(validTransfer);

    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("reports missing required Travel Rule data", () => {
    const result = validateTravelRuleTransfer({
      ...validTransfer,
      transferId: "",
      assetId: "",
      networkId: "",
      amount: "0",
      originator: {
        ...validTransfer.originator,
        name: "",
        accountIdentifier: "",
      },
      beneficiary: {
        ...validTransfer.beneficiary,
        name: "",
        accountIdentifier: "",
      },
    });

    expect(result.valid).toBe(false);
    expect(result.missing).toEqual([
      "missing_transfer_id",
      "missing_asset_id",
      "missing_network_id",
      "invalid_amount",
      "missing_originator_name",
      "missing_originator_account",
      "missing_beneficiary_name",
      "missing_beneficiary_account",
    ]);
  });
});

describe("ComplianceCaseManager", () => {
  const signal = {
    subjectId: "subject-1",
    transactionType: "withdrawal" as const,
    transactionId: "tx-1",
    ruleCode: "HIGH_VELOCITY",
    riskScore: 85,
    reason: "High withdrawal velocity",
  };

  it("creates a critical case from suspicious activity", () => {
    const manager = new ComplianceCaseManager();

    const result = manager.createFromSuspiciousActivity(signal, "case-1", "2026-09-15T10:00:00Z");

    expect(result.id).toBe("case-1");
    expect(result.subjectId).toBe("subject-1");
    expect(result.caseType).toBe("transaction_monitoring");
    expect(result.priority).toBe("critical");
    expect(result.status).toBe("open");
  });

  it("maps suspicious activity score to high priority", () => {
    const manager = new ComplianceCaseManager();

    const result = manager.createFromSuspiciousActivity(
      {
        ...signal,
        riskScore: 60,
      },
      "case-2",
      "2026-09-15T10:00:00Z",
    );

    expect(result.priority).toBe("high");
  });

  it("maps lower suspicious activity score to normal priority", () => {
    const manager = new ComplianceCaseManager();

    const result = manager.createFromSuspiciousActivity(
      {
        ...signal,
        riskScore: 30,
      },
      "case-3",
      "2026-09-15T10:00:00Z",
    );

    expect(result.priority).toBe("normal");
  });

  it("enforces the compliance case lifecycle", () => {
    const manager = new ComplianceCaseManager();

    manager.createFromSuspiciousActivity(signal, "case-4", "2026-09-15T10:00:00Z");

    const investigating = manager.startInvestigation(
      "case-4",
      "compliance-analyst",
      "2026-09-15T10:05:00Z",
      "Manual investigation started",
    );

    expect(investigating.status).toBe("investigating");

    const escalated = manager.escalate(
      "case-4",
      "senior-analyst",
      "2026-09-15T10:10:00Z",
      "Escalating for enhanced review",
    );

    expect(escalated.status).toBe("escalated");

    const resolved = manager.resolve(
      "case-4",
      "senior-analyst",
      "2026-09-15T11:00:00Z",
      "Investigation completed",
    );

    expect(resolved.status).toBe("resolved");
    expect(resolved.resolvedAt).toBe("2026-09-15T11:00:00Z");

    const closed = manager.close(
      "case-4",
      "compliance-admin",
      "2026-09-15T11:05:00Z",
      "Case archived",
    );

    expect(closed.status).toBe("closed");

    expect(manager.getTransitions("case-4")).toHaveLength(4);
  });

  it("rejects invalid case transitions", () => {
    const manager = new ComplianceCaseManager();

    manager.createFromSuspiciousActivity(signal, "case-5", "2026-09-15T10:00:00Z");

    expect(() =>
      manager.resolve("case-5", "analyst", "2026-09-15T10:05:00Z", "Invalid direct resolution"),
    ).toThrow("Only investigating or escalated cases can be resolved");
  });

  it("rejects suspicious activity with an invalid risk score", () => {
    const manager = new ComplianceCaseManager();

    expect(() =>
      manager.createFromSuspiciousActivity(
        {
          ...signal,
          riskScore: 101,
        },
        "case-6",
        "2026-09-15T10:00:00Z",
      ),
    ).toThrow("Risk score must be between 0 and 100");
  });
});
