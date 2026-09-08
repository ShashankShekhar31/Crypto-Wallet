import { describe, expect, it } from "vitest";

import { authorizeDAppRequest, createDAppApproval, DAppAuthorizationError } from "../approval.js";

import { createDAppPermission } from "../permissions.js";

import { createDAppRequest } from "../requests.js";

describe("authorizeDAppRequest", () => {
  it("authorizes a connect request with connect capability", () => {
    const request = createDAppRequest({
      id: "request-1",
      type: "connect",
      origin: "https://example.com",
      accountId: "account-1",
      chain: "evm",
    });

    const permission = createDAppPermission({
      origin: "https://example.com",
      accountId: "account-1",
      chain: "evm",
      capabilities: ["connect"],
    });

    expect(() => authorizeDAppRequest(request, permission)).not.toThrow();
  });

  it("authorizes a sign request with sign capability", () => {
    const request = createDAppRequest({
      id: "request-2",
      type: "sign",
      origin: "https://example.com",
      accountId: "account-1",
      chain: "evm",
      message: "Hello wallet",
    });

    const permission = createDAppPermission({
      origin: "https://example.com",
      accountId: "account-1",
      chain: "evm",
      capabilities: ["connect", "sign"],
    });

    expect(() => authorizeDAppRequest(request, permission)).not.toThrow();
  });

  it("authorizes a transaction request with transact capability", () => {
    const request = createDAppRequest({
      id: "request-3",
      type: "transaction",
      origin: "https://example.com",
      accountId: "account-1",
      chain: "evm",
      transaction: {
        to: "0x123",
        value: "100",
      },
    });

    const permission = createDAppPermission({
      origin: "https://example.com",
      accountId: "account-1",
      chain: "evm",
      capabilities: ["connect", "transact"],
    });

    expect(() => authorizeDAppRequest(request, permission)).not.toThrow();
  });

  it("rejects a request without a permission", () => {
    const request = createDAppRequest({
      id: "request-4",
      type: "connect",
      origin: "https://example.com",
      accountId: "account-1",
      chain: "evm",
    });

    expect(() => authorizeDAppRequest(request, undefined)).toThrow(DAppAuthorizationError);
  });

  it("rejects sign without sign capability", () => {
    const request = createDAppRequest({
      id: "request-5",
      type: "sign",
      origin: "https://example.com",
      accountId: "account-1",
      chain: "evm",
      message: "Hello",
    });

    const permission = createDAppPermission({
      origin: "https://example.com",
      accountId: "account-1",
      chain: "evm",
      capabilities: ["connect"],
    });

    expect(() => authorizeDAppRequest(request, permission)).toThrow(
      "dApp request requires sign capability",
    );
  });

  it("rejects transaction without transact capability", () => {
    const request = createDAppRequest({
      id: "request-6",
      type: "transaction",
      origin: "https://example.com",
      accountId: "account-1",
      chain: "evm",
      transaction: {
        to: "0x123",
        value: "100",
      },
    });

    const permission = createDAppPermission({
      origin: "https://example.com",
      accountId: "account-1",
      chain: "evm",
      capabilities: ["connect", "sign"],
    });

    expect(() => authorizeDAppRequest(request, permission)).toThrow(
      "dApp request requires transact capability",
    );
  });

  it("rejects a different origin", () => {
    const request = createDAppRequest({
      id: "request-7",
      type: "sign",
      origin: "https://evil.example.com",
      accountId: "account-1",
      chain: "evm",
      message: "Hello",
    });

    const permission = createDAppPermission({
      origin: "https://example.com",
      accountId: "account-1",
      chain: "evm",
      capabilities: ["connect", "sign"],
    });

    expect(() => authorizeDAppRequest(request, permission)).toThrow(
      "dApp request is not bound to the granted permission",
    );
  });

  it("rejects a different account", () => {
    const request = createDAppRequest({
      id: "request-8",
      type: "sign",
      origin: "https://example.com",
      accountId: "account-2",
      chain: "evm",
      message: "Hello",
    });

    const permission = createDAppPermission({
      origin: "https://example.com",
      accountId: "account-1",
      chain: "evm",
      capabilities: ["connect", "sign"],
    });

    expect(() => authorizeDAppRequest(request, permission)).toThrow(
      "dApp request is not bound to the granted permission",
    );
  });

  it("rejects a different chain", () => {
    const request = createDAppRequest({
      id: "request-9",
      type: "sign",
      origin: "https://example.com",
      accountId: "account-1",
      chain: "solana",
      message: "Hello",
    });

    const permission = createDAppPermission({
      origin: "https://example.com",
      accountId: "account-1",
      chain: "evm",
      capabilities: ["connect", "sign"],
    });

    expect(() => authorizeDAppRequest(request, permission)).toThrow(
      "dApp request is not bound to the granted permission",
    );
  });
});

describe("createDAppApproval", () => {
  it("creates an approval decision for the request", () => {
    const request = createDAppRequest({
      id: "request-10",
      type: "connect",
      origin: "https://example.com",
      accountId: "account-1",
      chain: "evm",
    });

    const approval = createDAppApproval(request, "approve");

    expect(approval.requestId).toBe("request-10");
    expect(approval.decision).toBe("approve");
    expect(approval.approvedAt).toEqual(expect.any(String));
  });

  it("can represent a rejected request", () => {
    const request = createDAppRequest({
      id: "request-11",
      type: "sign",
      origin: "https://example.com",
      accountId: "account-1",
      chain: "evm",
      message: "Hello",
    });

    const approval = createDAppApproval(request, "reject");

    expect(approval).toMatchObject({
      requestId: "request-11",
      decision: "reject",
    });
  });
});
