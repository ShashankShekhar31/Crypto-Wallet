import {
  DefaultReconciliationEngine,
  type ReconciliationComparison,
  type ReconciliationObservation,
  type ReconciliationRepository,
} from "@crypto-wallet/ledger-core";

export class ReconciliationService {
  private readonly engine: DefaultReconciliationEngine;

  constructor(
    private readonly repository: ReconciliationRepository,
  ) {
    this.engine = new DefaultReconciliationEngine();
  }

  async reconcile(
    expected: ReconciliationObservation,
    actual: ReconciliationObservation,
  ): Promise<ReconciliationComparison> {
    const comparison = this.engine.compare(expected, actual);

    await this.repository.save(comparison);

    return comparison;
  }

  async findLatest(
    assetId: string,
    networkId?: string,
    accountId?: string,
  ): Promise<ReconciliationComparison | null> {
    return this.repository.findLatest(
      assetId,
      networkId,
      accountId,
    );
  }
}