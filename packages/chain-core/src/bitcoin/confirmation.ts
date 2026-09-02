import type { BitcoinTransactionStatus } from "./provider.js";

export type BitcoinConfirmationState =
  "pending" | "confirmed" | "sufficiently-confirmed" | "deeply-confirmed";

export interface BitcoinConfirmationPolicy {
  readonly confirmedAfter: number;
  readonly sufficientlyConfirmedAfter: number;
  readonly deeplyConfirmedAfter: number;
}

export const DEFAULT_BITCOIN_CONFIRMATION_POLICY: BitcoinConfirmationPolicy = Object.freeze({
  confirmedAfter: 1,
  sufficientlyConfirmedAfter: 3,
  deeplyConfirmedAfter: 6,
});

export function classifyBitcoinConfirmation(
  status: BitcoinTransactionStatus,
  policy: BitcoinConfirmationPolicy = DEFAULT_BITCOIN_CONFIRMATION_POLICY,
): BitcoinConfirmationState {
  if (!Number.isSafeInteger(status.confirmations) || status.confirmations < 0) {
    throw new Error("Bitcoin confirmation count must be a non-negative integer");
  }

  if (!Number.isSafeInteger(policy.confirmedAfter) || policy.confirmedAfter < 1) {
    throw new Error("Bitcoin confirmed threshold must be a positive integer");
  }

  if (
    !Number.isSafeInteger(policy.sufficientlyConfirmedAfter) ||
    policy.sufficientlyConfirmedAfter < policy.confirmedAfter
  ) {
    throw new Error(
      "Bitcoin sufficiently confirmed threshold must be greater than or equal to the confirmed threshold",
    );
  }

  if (
    !Number.isSafeInteger(policy.deeplyConfirmedAfter) ||
    policy.deeplyConfirmedAfter < policy.sufficientlyConfirmedAfter
  ) {
    throw new Error(
      "Bitcoin deeply confirmed threshold must be greater than or equal to the sufficiently confirmed threshold",
    );
  }

  if (!status.confirmed || status.confirmations < policy.confirmedAfter) {
    return "pending";
  }

  if (status.confirmations < policy.sufficientlyConfirmedAfter) {
    return "confirmed";
  }

  if (status.confirmations < policy.deeplyConfirmedAfter) {
    return "sufficiently-confirmed";
  }

  return "deeply-confirmed";
}
