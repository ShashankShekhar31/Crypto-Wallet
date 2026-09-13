export type ReconciliationSource = "ledger" | "custody" | "blockchain" | "fiat";

export type ReconciliationStatus = "matched" | "mismatched" | "unavailable";

export type ReconciliationObservationStatus = "available" | "unavailable";

export interface ReconciliationScope {
  assetId: string;
  networkId?: string;
  accountId?: string;
}

export interface ReconciliationObservation {
  source: ReconciliationSource;
  scope: ReconciliationScope;
  status: ReconciliationObservationStatus;
  amount: string | null;
  observedAt: string;
  reference?: string;
}

export interface ReconciliationComparison {
  scope: ReconciliationScope;
  expected: ReconciliationObservation;
  actual: ReconciliationObservation;
  difference: string | null;
  status: ReconciliationStatus;
}

export interface ReconciliationContract {
  compare(
    expected: ReconciliationObservation,
    actual: ReconciliationObservation,
  ): ReconciliationComparison;
}
