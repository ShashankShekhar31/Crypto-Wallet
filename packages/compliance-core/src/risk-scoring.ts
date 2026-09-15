export type RiskFactorCategory = "account" | "device" | "withdrawal" | "transaction";

export interface RiskFactor {
  category: RiskFactorCategory;
  code: string;
  score: number;
  reason: string;
}

export interface RiskScoringInput {
  account: {
    accountAgeDays: number;
    priorComplianceReviews: number;
    priorAlerts: number;
  };

  device: {
    known: boolean;
    recentDeviceChanges: number;
    failedAuthenticationAttempts: number;
  };

  withdrawal: {
    amount: string;
    recentWithdrawalCount: number;
    newDestination: boolean;
    recentlyChangedSecuritySettings: boolean;
  };

  transaction: {
    amount: string;
    velocityCount: number;
    velocityWindowMinutes: number;
    unusualAsset: boolean;
    unusualNetwork: boolean;
  };
}

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface RiskAssessment {
  score: number;
  riskLevel: RiskLevel;
  factors: readonly RiskFactor[];
}

function addFactor(
  factors: RiskFactor[],
  category: RiskFactorCategory,
  code: string,
  score: number,
  reason: string,
): void {
  if (score <= 0) {
    return;
  }

  factors.push({
    category,
    code,
    score,
    reason,
  });
}

function classifyRisk(score: number): RiskLevel {
  if (score >= 80) {
    return "critical";
  }

  if (score >= 60) {
    return "high";
  }

  if (score >= 30) {
    return "medium";
  }

  return "low";
}

function parsePositiveAmount(amount: string, field: string): bigint {
  if (!/^[0-9]+$/.test(amount)) {
    throw new Error(`${field} amount must be a non-negative integer string`);
  }

  return BigInt(amount);
}

export function calculateRiskAssessment(input: RiskScoringInput): RiskAssessment {
  const factors: RiskFactor[] = [];

  if (input.account.accountAgeDays < 7) {
    addFactor(factors, "account", "NEW_ACCOUNT", 15, "Account is less than seven days old");
  }

  if (input.account.priorComplianceReviews > 0) {
    addFactor(
      factors,
      "account",
      "PRIOR_COMPLIANCE_REVIEW",
      Math.min(input.account.priorComplianceReviews * 5, 15),
      "Account has prior compliance reviews",
    );
  }

  if (input.account.priorAlerts > 0) {
    addFactor(
      factors,
      "account",
      "PRIOR_ALERTS",
      Math.min(input.account.priorAlerts * 5, 20),
      "Account has prior transaction-monitoring alerts",
    );
  }

  if (!input.device.known) {
    addFactor(
      factors,
      "device",
      "UNKNOWN_DEVICE",
      15,
      "Transaction originated from an unknown device",
    );
  }

  if (input.device.recentDeviceChanges > 0) {
    addFactor(
      factors,
      "device",
      "RECENT_DEVICE_CHANGE",
      Math.min(input.device.recentDeviceChanges * 10, 20),
      "Recent device changes increase account-takeover risk",
    );
  }

  if (input.device.failedAuthenticationAttempts > 0) {
    addFactor(
      factors,
      "device",
      "FAILED_AUTHENTICATION",
      Math.min(input.device.failedAuthenticationAttempts * 3, 15),
      "Recent authentication failures increase risk",
    );
  }

  parsePositiveAmount(input.withdrawal.amount, "Withdrawal");

  if (input.withdrawal.recentWithdrawalCount >= 5) {
    addFactor(
      factors,
      "withdrawal",
      "WITHDRAWAL_VELOCITY",
      15,
      "Multiple recent withdrawals indicate elevated withdrawal velocity",
    );
  }

  if (input.withdrawal.newDestination) {
    addFactor(
      factors,
      "withdrawal",
      "NEW_DESTINATION",
      20,
      "Withdrawal destination has not previously been used",
    );
  }

  if (input.withdrawal.recentlyChangedSecuritySettings) {
    addFactor(
      factors,
      "withdrawal",
      "RECENT_SECURITY_CHANGE",
      25,
      "Security settings were recently changed before withdrawal",
    );
  }

  parsePositiveAmount(input.transaction.amount, "Transaction");

  if (input.transaction.velocityCount >= 10 && input.transaction.velocityWindowMinutes <= 60) {
    addFactor(
      factors,
      "transaction",
      "TRANSACTION_VELOCITY",
      20,
      "Transaction velocity is unusually high",
    );
  }

  if (input.transaction.unusualAsset) {
    addFactor(
      factors,
      "transaction",
      "UNUSUAL_ASSET",
      10,
      "Transaction uses an unusual asset for the account",
    );
  }

  if (input.transaction.unusualNetwork) {
    addFactor(
      factors,
      "transaction",
      "UNUSUAL_NETWORK",
      10,
      "Transaction uses an unusual network for the account",
    );
  }

  const score = Math.min(
    factors.reduce((total, factor) => total + factor.score, 0),
    100,
  );

  return Object.freeze({
    score,
    riskLevel: classifyRisk(score),
    factors: Object.freeze(factors),
  });
}
