import { describe, expect, it } from "vitest";

import {
  createHardwareTransactionReview,
  type HardwareTransactionReview,
} from "../transaction-review.js";

describe("createHardwareTransactionReview", () => {
  it("creates a valid transaction review", () => {
    const review: HardwareTransactionReview = createHardwareTransactionReview({
      review: {
        chain: "ethereum",
        recipient: "0x0000000000000000000000000000000000000001",
        amount: "0.1 ETH",
        fee: "0.002 ETH",
      },
      payload: new Uint8Array([1, 2, 3]),
    });

    expect(review).toEqual({
      chain: "ethereum",
      recipient: "0x0000000000000000000000000000000000000001",
      amount: "0.1 ETH",
      fee: "0.002 ETH",
    });
  });

  it("rejects a missing chain", () => {
    expect(() =>
      createHardwareTransactionReview({
        review: {
          chain: "   ",
          recipient: "recipient",
          amount: "1 ETH",
          fee: "0.01 ETH",
        },
        payload: new Uint8Array(),
      }),
    ).toThrow("Transaction review chain is required");
  });

  it("rejects a missing recipient", () => {
    expect(() =>
      createHardwareTransactionReview({
        review: {
          chain: "ethereum",
          recipient: "   ",
          amount: "1 ETH",
          fee: "0.01 ETH",
        },
        payload: new Uint8Array(),
      }),
    ).toThrow("Transaction review recipient is required");
  });

  it("rejects a missing amount", () => {
    expect(() =>
      createHardwareTransactionReview({
        review: {
          chain: "ethereum",
          recipient: "recipient",
          amount: "   ",
          fee: "0.01 ETH",
        },
        payload: new Uint8Array(),
      }),
    ).toThrow("Transaction review amount is required");
  });

  it("rejects a missing fee", () => {
    expect(() =>
      createHardwareTransactionReview({
        review: {
          chain: "ethereum",
          recipient: "recipient",
          amount: "1 ETH",
          fee: "   ",
        },
        payload: new Uint8Array(),
      }),
    ).toThrow("Transaction review fee is required");
  });

  it("does not expose the signing payload in the review", () => {
    const payload = new Uint8Array([10, 20, 30]);

    const review = createHardwareTransactionReview({
      review: {
        chain: "ethereum",
        recipient: "recipient",
        amount: "1 ETH",
        fee: "0.01 ETH",
      },
      payload,
    });

    expect(review).not.toHaveProperty("payload");
    expect(review).not.toHaveProperty("privateKey");
    expect(review).not.toHaveProperty("seed");
  });
});
