import { describe, expect, it } from "vitest";

import { createHardwareTransactionApproval } from "../approval.js";

function createRequest() {
  return {
    review: {
      chain: "ethereum",
      recipient: "0x0000000000000000000000000000000000000001",
      amount: "0.1 ETH",
      fee: "0.002 ETH",
    },
    signRequest: {
      chain: "ethereum",
      derivationPath: "m/44'/60'/0'/0/0",
      payload: new Uint8Array([1, 2, 3]),
    },
  };
}

describe("createHardwareTransactionApproval", () => {
  it("binds the transaction review to its signing request", () => {
    const approval = createHardwareTransactionApproval(createRequest());

    expect(approval.review).toEqual({
      chain: "ethereum",
      recipient: "0x0000000000000000000000000000000000000001",
      amount: "0.1 ETH",
      fee: "0.002 ETH",
    });

    expect(approval.signRequest.chain).toBe("ethereum");
    expect(approval.signRequest.derivationPath).toBe("m/44'/60'/0'/0/0");
    expect(approval.signRequest.payload).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("rejects a review and signing request for different chains", () => {
    const request = createRequest();

    request.signRequest.chain = "bitcoin";

    expect(() => createHardwareTransactionApproval(request)).toThrow(
      "Transaction review chain does not match signing request chain",
    );
  });

  it("keeps the signing payload out of the review object", () => {
    const approval = createHardwareTransactionApproval(createRequest());

    expect(approval.review).not.toHaveProperty("payload");
    expect(approval.review).not.toHaveProperty("privateKey");
    expect(approval.review).not.toHaveProperty("seed");
    expect(approval.review).not.toHaveProperty("mnemonic");
  });

  it("copies the signing payload", () => {
    const request = createRequest();

    const approval = createHardwareTransactionApproval(request);

    request.signRequest.payload[0] = 99;

    expect(approval.signRequest.payload).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("returns a frozen approval boundary", () => {
    const approval = createHardwareTransactionApproval(createRequest());

    expect(Object.isFrozen(approval)).toBe(true);
    expect(Object.isFrozen(approval.signRequest)).toBe(true);
  });
});
