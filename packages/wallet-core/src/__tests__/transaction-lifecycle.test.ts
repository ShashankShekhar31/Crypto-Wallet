import { describe, expect, it } from "vitest";

import { canTransitionTransaction, transitionTransaction } from "../transaction-lifecycle.js";
import type { TransactionStatus } from "@crypto-wallet/shared-types";

describe("transaction lifecycle", () => {
  it("allows draft to signed", () => {
    expect(canTransitionTransaction("draft", "signed")).toBe(true);
  });

  it("allows signed to submitted", () => {
    expect(canTransitionTransaction("signed", "submitted")).toBe(true);
  });

  it("allows submitted to pending", () => {
    expect(canTransitionTransaction("submitted", "pending")).toBe(true);
  });

  it("allows pending to confirmed", () => {
    expect(canTransitionTransaction("pending", "confirmed")).toBe(true);
  });

  it("allows pending to failed", () => {
    expect(canTransitionTransaction("pending", "failed")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(canTransitionTransaction("draft", "confirmed")).toBe(false);
    expect(canTransitionTransaction("confirmed", "pending")).toBe(false);
    expect(canTransitionTransaction("failed", "signed")).toBe(false);
  });

  it("transitions a valid status", () => {
    expect(transitionTransaction("draft", "signed")).toBe("signed");
    expect(transitionTransaction("pending", "confirmed")).toBe("confirmed");
  });

  it("throws when a transition is invalid", () => {
    expect(() => transitionTransaction("draft", "confirmed")).toThrow(
      "Invalid transaction transition: draft -> confirmed",
    );
  });

  it("supports terminal confirmed state", () => {
    const status: TransactionStatus = "confirmed";

    expect(canTransitionTransaction(status, "pending")).toBe(false);
    expect(canTransitionTransaction(status, "failed")).toBe(false);
  });

  it("supports terminal failed state", () => {
    const status: TransactionStatus = "failed";

    expect(canTransitionTransaction(status, "draft")).toBe(false);
    expect(canTransitionTransaction(status, "pending")).toBe(false);
  });
});
