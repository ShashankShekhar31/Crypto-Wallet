import { describe, expect, it } from "vitest";

import {
  DefaultWalletCrypto,
  Secp256k1WalletSigner,
} from "@crypto-wallet/crypto";

import { DefaultEvmTransactionSigner } from "../transaction-signer.js";

import { encodeEip1559SignedTransaction } from "../signed-transaction.js";

import { createEvmUnsignedTransaction } from "../transaction.js";

import { createEip1559SigningDigest } from "../transaction-signing.js";

import type { EvmNetworkConfig } from "../types.js";

describe("EVM transaction signing integration", () => {
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

  async function createTestKey() {
  const walletCrypto =
    new DefaultWalletCrypto();

  const seed =
    await walletCrypto.mnemonic.toSeed(
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
    );

  const key =
    walletCrypto.deriver.fromSeed(seed);

  return {
    seed,
    key,
  };
}

  it("signs and encodes an EIP-1559 transaction end-to-end", async () => {
    const { seed, key } = await createTestKey();

    try {
      const walletSigner = new Secp256k1WalletSigner();

      const transactionSigner = new DefaultEvmTransactionSigner(walletSigner);

      const transaction = createEvmUnsignedTransaction(network, {
        to,
        nonce: 7n,
        gasLimit: 21000n,
        maxFeePerGas: 30_000_000_000n,
        maxPriorityFeePerGas: 2_000_000_000n,
      });

      const signature = await transactionSigner.signTransaction(transaction, key);

      expect(signature.compact).toHaveLength(64);

      expect(signature.recovery).toBeGreaterThanOrEqual(0);

      expect(signature.recovery).toBeLessThanOrEqual(3);

      const digest = createEip1559SigningDigest(transaction);

      const directSignature = walletSigner.signDigest(key, digest);

      expect(signature.compact).toEqual(directSignature.compact);

      expect(signature.recovery).toBe(directSignature.recovery);

      const encoded = encodeEip1559SignedTransaction(transaction, signature);

      expect(encoded.length).toBeGreaterThan(0);

      expect(encoded[0]).toBe(0x02);

      expect(Buffer.from(encoded).toString("hex").startsWith("02")).toBe(true);
    } finally {
      key.wipe();
      seed.wipe();
    }
  });

  it("produces the same signature for the same transaction and key", async () => {
    const { seed, key } = await createTestKey();

    try {
      const walletSigner = new Secp256k1WalletSigner();

      const transactionSigner = new DefaultEvmTransactionSigner(walletSigner);

      const transaction = createEvmUnsignedTransaction(network, {
        to,
        nonce: 7n,
        gasLimit: 21000n,
        maxFeePerGas: 30_000_000_000n,
        maxPriorityFeePerGas: 2_000_000_000n,
      });

      const first = await transactionSigner.signTransaction(transaction, key);

      const second = await transactionSigner.signTransaction(transaction, key);

      expect(first.compact).toEqual(second.compact);

      expect(first.recovery).toBe(second.recovery);
    } finally {
      key.wipe();
      seed.wipe();
    }
  });

  it("signs a transaction containing value and calldata", async () => {
    const { seed, key } = await createTestKey();

    try {
      const walletSigner = new Secp256k1WalletSigner();

      const transactionSigner = new DefaultEvmTransactionSigner(walletSigner);

      const transaction = createEvmUnsignedTransaction(network, {
        to,
        value: 12345n,
        nonce: 1n,
        gasLimit: 50000n,
        maxFeePerGas: 100n,
        maxPriorityFeePerGas: 2n,
        data: "0x1234",
      });

      const signature = await transactionSigner.signTransaction(transaction, key);

      const encoded = encodeEip1559SignedTransaction(transaction, signature);

      expect(encoded[0]).toBe(0x02);

      expect(encoded.length).toBeGreaterThan(100);
    } finally {
      key.wipe();
      seed.wipe();
    }
  });
});
