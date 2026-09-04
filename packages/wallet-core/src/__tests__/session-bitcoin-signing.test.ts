import { describe, expect, it } from "vitest";

import { DefaultWalletCrypto } from "@crypto-wallet/crypto";
import { MemorySecureStorageAdapter, createWalletVault } from "@crypto-wallet/secure-storage";
import {
  bitcoinAddressToScriptPubKey,
  createBitcoinTransaction,
  deriveBitcoinAddress,
} from "@crypto-wallet/chain-core";

import { createWalletSession } from "../create-session.js";
import { MNEMONIC_STORAGE_KEY } from "../wallet-lifecycle.js";

const PASSWORD = "correct horse battery staple";

const MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

const TXID = "0000000000000000000000000000000000000000000000000000000000000001";

async function createSessionFixture() {
  const crypto = new DefaultWalletCrypto();

  const vault = createWalletVault(new MemorySecureStorageAdapter(), {
    inactivityTimeoutMs: 15 * 60 * 1000,
  });

  await vault.unlock(PASSWORD);

  vault.set(MNEMONIC_STORAGE_KEY, new TextEncoder().encode(MNEMONIC));

  await vault.persist();

  const session = createWalletSession(vault, crypto);

  const seed = await crypto.mnemonic.toSeed(MNEMONIC);

  try {
    const sourceAddress = deriveBitcoinAddress(seed, "native-segwit", "bitcoin-testnet", 0, 0, 0);

    const sourceScript = bitcoinAddressToScriptPubKey(sourceAddress, "bitcoin-testnet");

    const recipientAddress = deriveBitcoinAddress(
      seed,
      "native-segwit",
      "bitcoin-testnet",
      0,
      0,
      1,
    );

    const recipientScript = bitcoinAddressToScriptPubKey(recipientAddress, "bitcoin-testnet");

    const transaction = createBitcoinTransaction({
      network: "bitcoin-testnet",
      version: 2,
      inputs: [
        {
          previousTxid: TXID,
          previousOutputIndex: 0,
          scriptSig: new Uint8Array(),
          sequence: 0xffffffff,
          previousOutput: {
            value: 100_000n,
            scriptPubKey: sourceScript,
          },
        },
      ],
      outputs: [
        {
          value: 90_000n,
          scriptPubKey: recipientScript,
        },
      ],
      lockTime: 0,
    });

    return {
      session,
      transaction,
    };
  } finally {
    seed.wipe();
  }
}

describe("WalletSession Bitcoin signing boundary", () => {
  it("signs a Bitcoin transaction through the wallet session", async () => {
    const { session, transaction } = await createSessionFixture();

    const result = await session.signBitcoinTransaction({
      network: "bitcoin-testnet",
      transaction,
      addressType: "native-segwit",
      account: 0,
      change: 0,
      addressIndex: 0,
    });

    expect(result.network).toBe("bitcoin-testnet");
    expect(result.transaction).toBe(transaction);
    expect(result.rawTransaction).toBeInstanceOf(Uint8Array);
    expect(result.rawTransaction.length).toBeGreaterThan(0);
  });

  it("does not sign while the wallet session is locked", async () => {
    const { session, transaction } = await createSessionFixture();

    session.lock();

    await expect(
      session.signBitcoinTransaction({
        network: "bitcoin-testnet",
        transaction,
      }),
    ).rejects.toThrow("Wallet is locked");
  });

  it("rejects a transaction network mismatch", async () => {
    const { session, transaction } = await createSessionFixture();

    await expect(
      session.signBitcoinTransaction({
        network: "bitcoin-mainnet",
        transaction,
      }),
    ).rejects.toThrow("Bitcoin transaction network does not match signing request");
  });

  it("does not expose mnemonic, seed, or private key material", async () => {
    const { session, transaction } = await createSessionFixture();

    const result = await session.signBitcoinTransaction({
      network: "bitcoin-testnet",
      transaction,
    });

    expect(result).not.toHaveProperty("mnemonic");
    expect(result).not.toHaveProperty("seed");
    expect(result).not.toHaveProperty("privateKey");

    expect(session.vault.get(MNEMONIC_STORAGE_KEY)).not.toBeNull();
  });
});
