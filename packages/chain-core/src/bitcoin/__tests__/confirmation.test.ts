import { describe, expect, it } from "vitest";

import {
  DEFAULT_BITCOIN_CONFIRMATION_POLICY,
  classifyBitcoinConfirmation,
} from "../confirmation.js";

import type { BitcoinTransactionStatus } from "../provider.js";

function createStatus(
  confirmations: number,
  confirmed = confirmations > 0,
): BitcoinTransactionStatus {
  return {
    txid: "a".repeat(64),
    confirmed,
    confirmations,
  };
}

describe("classifyBitcoinConfirmation", () => {
  it("returns pending for an unconfirmed transaction", () => {
    expect(classifyBitcoinConfirmation(createStatus(0, false))).toBe("pending");
  });

  it("returns pending below the confirmed threshold", () => {
    expect(
      classifyBitcoinConfirmation(createStatus(0, true), DEFAULT_BITCOIN_CONFIRMATION_POLICY),
    ).toBe("pending");
  });

  it("returns confirmed at one confirmation", () => {
    expect(classifyBitcoinConfirmation(createStatus(1))).toBe("confirmed");
  });

  it("returns confirmed at two confirmations", () => {
    expect(classifyBitcoinConfirmation(createStatus(2))).toBe("confirmed");
  });

  it("returns sufficiently-confirmed at three confirmations", () => {
    expect(classifyBitcoinConfirmation(createStatus(3))).toBe("sufficiently-confirmed");
  });

  it("returns sufficiently-confirmed at five confirmations", () => {
    expect(classifyBitcoinConfirmation(createStatus(5))).toBe("sufficiently-confirmed");
  });

  it("returns deeply-confirmed at six confirmations", () => {
    expect(classifyBitcoinConfirmation(createStatus(6))).toBe("deeply-confirmed");
  });

  it("returns deeply-confirmed above six confirmations", () => {
    expect(classifyBitcoinConfirmation(createStatus(12))).toBe("deeply-confirmed");
  });

  it("supports a custom confirmation policy", () => {
    expect(
      classifyBitcoinConfirmation(createStatus(2), {
        confirmedAfter: 2,
        sufficientlyConfirmedAfter: 4,
        deeplyConfirmedAfter: 8,
      }),
    ).toBe("confirmed");

    expect(
      classifyBitcoinConfirmation(createStatus(4), {
        confirmedAfter: 2,
        sufficientlyConfirmedAfter: 4,
        deeplyConfirmedAfter: 8,
      }),
    ).toBe("sufficiently-confirmed");

    expect(
      classifyBitcoinConfirmation(createStatus(8), {
        confirmedAfter: 2,
        sufficientlyConfirmedAfter: 4,
        deeplyConfirmedAfter: 8,
      }),
    ).toBe("deeply-confirmed");
  });

  it("rejects negative confirmation counts", () => {
    expect(() => classifyBitcoinConfirmation(createStatus(-1, false))).toThrow(
      "Bitcoin confirmation count must be a non-negative integer",
    );
  });

  it("rejects a non-integer confirmation count", () => {
    expect(() => classifyBitcoinConfirmation(createStatus(1.5, true))).toThrow(
      "Bitcoin confirmation count must be a non-negative integer",
    );
  });

  it("rejects an invalid confirmed threshold", () => {
    expect(() =>
      classifyBitcoinConfirmation(createStatus(1), {
        confirmedAfter: 0,
        sufficientlyConfirmedAfter: 3,
        deeplyConfirmedAfter: 6,
      }),
    ).toThrow("Bitcoin confirmed threshold must be a positive integer");
  });

  it("rejects an invalid sufficiently-confirmed threshold", () => {
    expect(() =>
      classifyBitcoinConfirmation(createStatus(3), {
        confirmedAfter: 4,
        sufficientlyConfirmedAfter: 3,
        deeplyConfirmedAfter: 6,
      }),
    ).toThrow(
      "Bitcoin sufficiently confirmed threshold must be greater than or equal to the confirmed threshold",
    );
  });

  it("rejects an invalid deeply-confirmed threshold", () => {
    expect(() =>
      classifyBitcoinConfirmation(createStatus(6), {
        confirmedAfter: 1,
        sufficientlyConfirmedAfter: 6,
        deeplyConfirmedAfter: 5,
      }),
    ).toThrow(
      "Bitcoin deeply confirmed threshold must be greater than or equal to the sufficiently confirmed threshold",
    );
  });
});
