import { describe, expect, it } from "vitest";

import {
  createEvmUnsignedTransaction,
} from "../transaction.js";

import type { EvmNetworkConfig } from "../types.js";

describe("createEvmUnsignedTransaction", () => {
  const network: EvmNetworkConfig = {
    id: "ethereum-mainnet",
    name: "Ethereum",
    chainId: 1n,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: [
      "https://rpc.example.com",
    ],
  };

  const to =
    "0x0000000000000000000000000000000000000002";

  it("creates an EIP-1559 unsigned transaction", () => {
    const transaction =
      createEvmUnsignedTransaction(network, {
        to,
        nonce: 7n,
        gasLimit: 21000n,
        maxFeePerGas: 30_000_000_000n,
        maxPriorityFeePerGas: 2_000_000_000n,
      });

    expect(transaction).toEqual({
      type: 2,
      chainId: 1n,
      nonce: 7n,
      maxPriorityFeePerGas: 2_000_000_000n,
      maxFeePerGas: 30_000_000_000n,
      gasLimit: 21000n,
      to,
      value: 0n,
      data: "0x",
    });
  });

  it("preserves transaction value", () => {
    const transaction =
      createEvmUnsignedTransaction(network, {
        to,
        value: 1_000_000_000_000_000_000n,
        nonce: 1n,
        gasLimit: 21000n,
        maxFeePerGas: 20n,
        maxPriorityFeePerGas: 2n,
      });

    expect(transaction.value).toBe(
      1_000_000_000_000_000_000n,
    );
  });

  it("normalizes transaction data", () => {
    const transaction =
      createEvmUnsignedTransaction(network, {
        to,
        nonce: 1n,
        gasLimit: 50000n,
        maxFeePerGas: 20n,
        maxPriorityFeePerGas: 2n,
        data: "0xABCD",
      });

    expect(transaction.data).toBe("0xabcd");
  });

  it("accepts an explicit zero value", () => {
    const transaction =
      createEvmUnsignedTransaction(network, {
        to,
        value: 0n,
        nonce: 0n,
        gasLimit: 21000n,
        maxFeePerGas: 20n,
        maxPriorityFeePerGas: 2n,
      });

    expect(transaction.value).toBe(0n);
  });

  it("rejects a negative nonce", () => {
    expect(() =>
      createEvmUnsignedTransaction(network, {
        to,
        nonce: -1n,
        gasLimit: 21000n,
        maxFeePerGas: 20n,
        maxPriorityFeePerGas: 2n,
      }),
    ).toThrow(
      "EVM transaction nonce must be non-negative",
    );
  });

  it("rejects a negative gas limit", () => {
    expect(() =>
      createEvmUnsignedTransaction(network, {
        to,
        nonce: 0n,
        gasLimit: -1n,
        maxFeePerGas: 20n,
        maxPriorityFeePerGas: 2n,
      }),
    ).toThrow(
      "EVM transaction gas limit must be non-negative",
    );
  });

  it("rejects a negative max fee", () => {
    expect(() =>
      createEvmUnsignedTransaction(network, {
        to,
        nonce: 0n,
        gasLimit: 21000n,
        maxFeePerGas: -1n,
        maxPriorityFeePerGas: 0n,
      }),
    ).toThrow(
      "EVM transaction max fee per gas must be non-negative",
    );
  });

  it("rejects a negative priority fee", () => {
    expect(() =>
      createEvmUnsignedTransaction(network, {
        to,
        nonce: 0n,
        gasLimit: 21000n,
        maxFeePerGas: 20n,
        maxPriorityFeePerGas: -1n,
      }),
    ).toThrow(
      "EVM transaction max priority fee per gas must be non-negative",
    );
  });

  it("rejects a priority fee greater than the max fee", () => {
    expect(() =>
      createEvmUnsignedTransaction(network, {
        to,
        nonce: 0n,
        gasLimit: 21000n,
        maxFeePerGas: 10n,
        maxPriorityFeePerGas: 11n,
      }),
    ).toThrow(
      "EVM transaction max priority fee per gas cannot exceed max fee per gas",
    );
  });

  it("rejects a negative value", () => {
    expect(() =>
      createEvmUnsignedTransaction(network, {
        to,
        value: -1n,
        nonce: 0n,
        gasLimit: 21000n,
        maxFeePerGas: 20n,
        maxPriorityFeePerGas: 2n,
      }),
    ).toThrow(
      "EVM transaction value must be non-negative",
    );
  });

  it("rejects an invalid recipient", () => {
    expect(() =>
      createEvmUnsignedTransaction(network, {
        to: "invalid-address",
        nonce: 0n,
        gasLimit: 21000n,
        maxFeePerGas: 20n,
        maxPriorityFeePerGas: 2n,
      }),
    ).toThrow("Invalid EVM address");
  });

  it("rejects malformed transaction data", () => {
    expect(() =>
      createEvmUnsignedTransaction(network, {
        to,
        nonce: 0n,
        gasLimit: 21000n,
        maxFeePerGas: 20n,
        maxPriorityFeePerGas: 2n,
        data: "0xabc",
      }),
    ).toThrow(
      "EVM transaction data must be even-length hexadecimal",
    );
  });

  it("returns an immutable transaction", () => {
    const transaction =
      createEvmUnsignedTransaction(network, {
        to,
        nonce: 0n,
        gasLimit: 21000n,
        maxFeePerGas: 20n,
        maxPriorityFeePerGas: 2n,
      });

    expect(
      Object.isFrozen(transaction),
    ).toBe(true);
  });
});