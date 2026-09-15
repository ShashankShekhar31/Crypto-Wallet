export type ComplianceSubjectType = "individual" | "business";

export type ComplianceSubjectStatus = "active" | "restricted" | "blocked" | "closed";

export type ComplianceRiskLevel = "unknown" | "low" | "medium" | "high" | "critical";

export type ScreeningType = "kyc" | "kyb" | "sanctions" | "pep" | "adverse_media";

export type ScreeningStatus = "pending" | "clear" | "match" | "review" | "failed";

export interface ComplianceSubject {
  id: string;
  userId: string;
  subjectType: ComplianceSubjectType;
  status: ComplianceSubjectStatus;
  riskLevel: ComplianceRiskLevel;
}

export interface ScreeningRequest {
  subjectId: string;
  screeningType: ScreeningType;
  reference: string;
}

export interface ScreeningObservation {
  screeningType: ScreeningType;
  status: ScreeningStatus;
  provider: string;
  providerReference?: string;
  screenedAt: string;
}

export type TransactionMonitoringType = "deposit" | "withdrawal" | "trade" | "transfer";

export interface TransactionMonitoringContext {
  subjectId?: string;
  transactionType: TransactionMonitoringType;
  transactionId: string;
  amount: string;
  assetId: string;
  occurredAt: string;
}
