import type {
  ReconciliationComparison,
  ReconciliationContract,
  ReconciliationObservation,
} from "./reconciliation-types.js";

export class DefaultReconciliationEngine implements ReconciliationContract {
  compare(
    expected: ReconciliationObservation,
    actual: ReconciliationObservation,
  ): ReconciliationComparison {
    if (!this.isSameScope(expected, actual)) {
      throw new Error("Reconciliation observations must use the same scope");
    }

    if (expected.status === "unavailable" || actual.status === "unavailable") {
      return {
        scope: expected.scope,
        expected,
        actual,
        difference: null,
        status: "unavailable",
      };
    }

    if (expected.amount === null || actual.amount === null) {
      throw new Error("Available reconciliation observations must have an amount");
    }

    const expectedAmount = this.parseAmount(expected.amount);
    const actualAmount = this.parseAmount(actual.amount);
    const difference = actualAmount - expectedAmount;

    return {
      scope: expected.scope,
      expected,
      actual,
      difference: difference.toString(),
      status: difference === 0n ? "matched" : "mismatched",
    };
  }

  private parseAmount(amount: string): bigint {
    if (!/^[0-9]+$/.test(amount)) {
      throw new Error("Reconciliation amount must be a non-negative integer");
    }

    return BigInt(amount);
  }

  private isSameScope(
    expected: ReconciliationObservation,
    actual: ReconciliationObservation,
  ): boolean {
    return (
      expected.scope.assetId === actual.scope.assetId &&
      expected.scope.networkId === actual.scope.networkId &&
      expected.scope.accountId === actual.scope.accountId
    );
  }
}
