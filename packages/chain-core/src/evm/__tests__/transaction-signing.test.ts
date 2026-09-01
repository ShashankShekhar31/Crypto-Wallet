import { describe, expect, it } from "vitest";

import {
  encodeEip1559SigningPayload,
  hashEip1559SigningPayload,
  createEip1559SigningDigest,
} from "../transaction-signing.js";

import { createEvmUnsignedTransaction } from "../transaction.js";

import type { EvmNetworkConfig } from "../types.js";

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

  it("encodes the EIP-1559 signing payload", () => {
    const transaction = createEvmUnsignedTransaction(network, {
      to,
      nonce: 7n,
      gasLimit: 21000n,
      maxFeePerGas: 30_000_000_000n,
      maxPriorityFeePerGas: 2_000_000_000n,
    });

    const payload = encodeEip1559SigningPayload(transaction);

    expect(Buffer.from(payload).toString("hex")).toBe(
      "02e8010784773594008506fc23ac008252089400000000000000000000000000000000000000028080c0",
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

    const payload = encodeEip1559SigningPayload(transaction);

    expect(Buffer.from(payload).toString("hex")).toBe(
      "02e30101026482c350940000000000000000000000000000000000000002823039821234c0",
    );
  });

  it("produces a 32-byte Keccak-256 signing digest", () => {
    const transaction = createEvmUnsignedTransaction(network, {
      to,
      nonce: 7n,
      gasLimit: 21000n,
      maxFeePerGas: 30_000_000_000n,
      maxPriorityFeePerGas: 2_000_000_000n,
    });

    const digest = hashEip1559SigningPayload(transaction);

    expect(digest).toHaveLength(32);
  });

  it("produces the same digest for the same transaction", () => {
    const transaction = createEvmUnsignedTransaction(network, {
      to,
      nonce: 7n,
      gasLimit: 21000n,
      maxFeePerGas: 30_000_000_000n,
      maxPriorityFeePerGas: 2_000_000_000n,
    });

    const first = hashEip1559SigningPayload(transaction);

    const second = hashEip1559SigningPayload(transaction);

    expect(first).toEqual(second);
  });

  it("changes the signing digest when the nonce changes", () => {
    const firstTransaction = createEvmUnsignedTransaction(network, {
      to,
      nonce: 7n,
      gasLimit: 21000n,
      maxFeePerGas: 30_000_000_000n,
      maxPriorityFeePerGas: 2_000_000_000n,
    });

    const secondTransaction = createEvmUnsignedTransaction(network, {
      to,
      nonce: 8n,
      gasLimit: 21000n,
      maxFeePerGas: 30_000_000_000n,
      maxPriorityFeePerGas: 2_000_000_000n,
    });

    const first = hashEip1559SigningPayload(firstTransaction);

    const second = hashEip1559SigningPayload(secondTransaction);

    expect(first).not.toEqual(second);
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
