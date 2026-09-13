import type { ReconciliationComparison } from "./reconciliation-types.js";

export interface ReconciliationRepository {
  save(comparison: ReconciliationComparison): Promise<void>;

  findLatest(
    assetId: string,
    networkId?: string,
    accountId?: string,
  ): Promise<ReconciliationComparison | null>;
}
