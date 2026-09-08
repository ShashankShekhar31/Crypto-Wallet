import { describe, expect, it } from "vitest";

import { createDAppRequest } from "../requests.js";

describe("createDAppRequest", () => {
  it("creates a connect request", () => {
    const request = createDAppRequest({
      id: "request-1",
      type: "connect",
      origin: "https://EXAMPLE.COM/",
      accountId: "account-1",
      chain: "evm",
      createdAt: "2026-09-07T00:00:00.000Z",
    });

    expect(request).toEqual({
      id: "request-1",
      type: "connect",
      origin: "https://example.com",
      accountId: "account-1",
      chain: "evm",
      createdAt: "2026-09-07T00:00:00.000Z",
    });
  });

  it("creates a sign request", () => {
    const request = createDAppRequest({
      id: "request-2",
      type: "sign",
      origin: "https://example.com",
      accountId: "account-1",
      chain: "evm",
      message: "Hello wallet",
    });

    expect(request.type).toBe("sign");

    if (request.type === "sign") {
      expect(request.message).toBe("Hello wallet");
    }
  });

  it("creates a transaction request", () => {
    const request = createDAppRequest({
      id: "request-3",
      type: "transaction",
      origin: "https://example.com",
      accountId: "account-1",
      chain: "evm",
      transaction: {
        to: "0x1234567890abcdef",
        value: "1000000000000000000",
        data: "0x",
      },
    });

    expect(request.type).toBe("transaction");

    if (request.type === "transaction") {
      expect(request.transaction).toEqual({
        to: "0x1234567890abcdef",
        value: "1000000000000000000",
        data: "0x",
      });
    }
  });

  it("normalizes the request origin", () => {
    const request = createDAppRequest({
      id: "request-4",
      type: "connect",
      origin: "https://EXAMPLE.COM/",
      accountId: "account-1",
      chain: "evm",
    });

    expect(request.origin).toBe("https://example.com");
  });

  it("requires a request ID", () => {
    expect(() =>
      createDAppRequest({
        id: " ",
        type: "connect",
        origin: "https://example.com",
        accountId: "account-1",
        chain: "evm",
      }),
    ).toThrow("Request ID is required");
  });

  it("requires an account ID", () => {
    expect(() =>
      createDAppRequest({
        id: "request-5",
        type: "connect",
        origin: "https://example.com",
        accountId: " ",
        chain: "evm",
      }),
    ).toThrow("Account ID is required");
  });

  it("requires a sign message", () => {
    expect(() =>
      createDAppRequest({
        id: "request-6",
        type: "sign",
        origin: "https://example.com",
        accountId: "account-1",
        chain: "evm",
        message: "",
      }),
    ).toThrow("Sign message is required");
  });

  it("requires a transaction recipient", () => {
    expect(() =>
      createDAppRequest({
        id: "request-7",
        type: "transaction",
        origin: "https://example.com",
        accountId: "account-1",
        chain: "evm",
        transaction: {
          to: " ",
          value: "100",
        },
      }),
    ).toThrow("Transaction recipient is required");
  });

  it("requires a transaction value", () => {
    expect(() =>
      createDAppRequest({
        id: "request-8",
        type: "transaction",
        origin: "https://example.com",
        accountId: "account-1",
        chain: "evm",
        transaction: {
          to: "0x123",
          value: " ",
        },
      }),
    ).toThrow("Transaction value is required");
  });

  it("rejects empty transaction data", () => {
    expect(() =>
      createDAppRequest({
        id: "request-9",
        type: "transaction",
        origin: "https://example.com",
        accountId: "account-1",
        chain: "evm",
        transaction: {
          to: "0x123",
          value: "100",
          data: " ",
        },
      }),
    ).toThrow("Transaction data cannot be empty");
  });

  it("uses the provided timestamp", () => {
    const request = createDAppRequest({
      id: "request-10",
      type: "connect",
      origin: "https://example.com",
      accountId: "account-1",
      chain: "solana",
      createdAt: "2026-09-07T12:00:00.000Z",
    });

    expect(request.createdAt).toBe("2026-09-07T12:00:00.000Z");
  });

  it("creates requests for supported chains", () => {
    const chains = ["evm", "solana", "bitcoin"] as const;

    for (const chain of chains) {
      const request = createDAppRequest({
        id: `request-${chain}`,
        type: "connect",
        origin: "https://example.com",
        accountId: "account-1",
        chain,
      });

      expect(request.chain).toBe(chain);
    }
  });
});
