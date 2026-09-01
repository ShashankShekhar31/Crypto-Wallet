import { describe, expect, it } from "vitest";

import { encodeEip1559SignedTransaction } from "../signed-transaction.js";

import { createEvmUnsignedTransaction } from "../transaction.js";

import type { EvmNetworkConfig } from "../types.js";

import { createEip1559SigningDigest, hashEip1559SigningPayload } from "../transaction-signing.js";

describe("EIP-1559 transaction signing", () => {
  const network: EvmNetworkConfig = {
    id: "ethereum-mainnet",
    name: "Ethereum",
    chainId: 1n,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: ["https://rpc.example.com"],
  };

  const to = "0x0000000000000000000000000000000000000002";

  it("encodes a signed EIP-1559 transaction", () => {
    const transaction = createEvmUnsignedTransaction(network, {
      to,
      nonce: 7n,
      gasLimit: 21000n,
      maxFeePerGas: 30_000_000_000n,
      maxPriorityFeePerGas: 2_000_000_000n,
    });

    const signature = {
      compact: new Uint8Array(64).fill(0x11),
      recovery: 0,
    };

    const encoded = encodeEip1559SignedTransaction(transaction, signature);

    expect(Buffer.from(encoded).toString("hex")).toBe(
      "02f86b010784773594008506fc23ac008252089400000000000000000000000000000000000000028080c080a01111111111111111111111111111111111111111111111111111111111111111a01111111111111111111111111111111111111111111111111111111111111111",
    );
  });

  it("includes transaction value and calldata", () => {
    const transaction = createEvmUnsignedTransaction(network, {
      to,
      value: 12345n,
      nonce: 1n,
      gasLimit: 50000n,
      maxFeePerGas: 100n,
      maxPriorityFeePerGas: 2n,
      data: "0x1234",
    });

    const signature = {
      compact: new Uint8Array(64).fill(0x22),
      recovery: 1,
    };

    const encoded = encodeEip1559SignedTransaction(transaction, signature);

    expect(Buffer.from(encoded).toString("hex")).toBe(
      "02f8660101026482c350940000000000000000000000000000000000000002823039821234c001a02222222222222222222222222222222222222222222222222222222222222222a02222222222222222222222222222222222222222222222222222222222222222",
    );
  });

  it("rejects signatures that are not 64 bytes", () => {
    const transaction = createEvmUnsignedTransaction(network, {
      to,
      nonce: 0n,
      gasLimit: 21000n,
      maxFeePerGas: 20n,
      maxPriorityFeePerGas: 2n,
    });

    expect(() =>
      encodeEip1559SignedTransaction(transaction, {
        compact: new Uint8Array(63),
        recovery: 0,
      }),
    ).toThrow("EVM transaction signature must be exactly 64 bytes");
  });

  it("rejects an invalid recovery identifier", () => {
    const transaction = createEvmUnsignedTransaction(network, {
      to,
      nonce: 0n,
      gasLimit: 21000n,
      maxFeePerGas: 20n,
      maxPriorityFeePerGas: 2n,
    });

    expect(() =>
      encodeEip1559SignedTransaction(transaction, {
        compact: new Uint8Array(64),
        recovery: 4,
      }),
    ).toThrow("EVM transaction recovery identifier must be between 0 and 3");
  });

  it("uses recovery parity for yParity", () => {
    const transaction = createEvmUnsignedTransaction(network, {
      to,
      nonce: 0n,
      gasLimit: 21000n,
      maxFeePerGas: 20n,
      maxPriorityFeePerGas: 2n,
    });

    const recoveryZero = encodeEip1559SignedTransaction(transaction, {
      compact: new Uint8Array(64),
      recovery: 0,
    });

    const recoveryOne = encodeEip1559SignedTransaction(transaction, {
      compact: new Uint8Array(64),
      recovery: 1,
    });

    expect(Buffer.from(recoveryZero).toString("hex")).not.toBe(
      Buffer.from(recoveryOne).toString("hex"),
    );
  });
  it("creates the EIP-1559 signing digest", () => {
    const transaction = createEvmUnsignedTransaction(network, {
      to,
      nonce: 7n,
      gasLimit: 21000n,
      maxFeePerGas: 30_000_000_000n,
      maxPriorityFeePerGas: 2_000_000_000n,
    });

    const digest = createEip1559SigningDigest(transaction);

    expect(digest).toHaveLength(32);

    expect(digest).toEqual(hashEip1559SigningPayload(transaction));
  });
});
