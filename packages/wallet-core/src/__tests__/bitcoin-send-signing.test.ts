import { describe, expect, it } from "vitest";

import { DefaultWalletCrypto } from "@crypto-wallet/crypto";
import { MemorySecureStorageAdapter, createWalletVault } from "@crypto-wallet/secure-storage";
import {
  bitcoinAddressToScriptPubKey,
  createBitcoinTransaction,
  deriveBitcoinAddress,
} from "@crypto-wallet/chain-core";

import { signBitcoinTransaction } from "../bitcoin-send-signing.js";
import { MNEMONIC_STORAGE_KEY } from "../wallet-lifecycle.js";

const PASSWORD = "correct horse battery staple";

const MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

const TXID = "0000000000000000000000000000000000000000000000000000000000000001";

function createVault() {
  return createWalletVault(new MemorySecureStorageAdapter(), {
    inactivityTimeoutMs: 15 * 60 * 1000,
  });
}

async function createSignedFixture() {
  const crypto = new DefaultWalletCrypto();
  const vault = createVault();

  await vault.unlock(PASSWORD);

  vault.set(MNEMONIC_STORAGE_KEY, new TextEncoder().encode(MNEMONIC));

  await vault.persist();

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
      crypto,
      vault,
      transaction,
    };
  } finally {
    seed.wipe();
  }
}

describe("Bitcoin transaction signing", () => {
  it("signs a native-segwit transaction through the wallet-core boundary", async () => {
    const { crypto, vault, transaction } = await createSignedFixture();

    const result = await signBitcoinTransaction(vault, crypto, {
      network: "bitcoin-testnet",
      transaction,
      addressType: "native-segwit",
      account: 0,
      change: 0,
      addressIndex: 0,
    });

    expect(result.network).toBe("bitcoin-testnet");
    expect(result.rawTransaction).toBeInstanceOf(Uint8Array);
    expect(result.rawTransaction.length).toBeGreaterThan(0);
    expect(result.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it("does not sign while the wallet is locked", async () => {
    const { crypto, vault, transaction } = await createSignedFixture();

    vault.lock();

    await expect(
      signBitcoinTransaction(vault, crypto, {
        network: "bitcoin-testnet",
        transaction,
      }),
    ).rejects.toThrow("Wallet is locked");
  });

  it("rejects a network mismatch", async () => {
    const { crypto, vault, transaction } = await createSignedFixture();

    await expect(
      signBitcoinTransaction(vault, crypto, {
        network: "bitcoin-mainnet",
        transaction,
      }),
    ).rejects.toThrow("Bitcoin transaction network does not match signing request");
  });

  it("does not expose mnemonic or private key material", async () => {
    const { crypto, vault, transaction } = await createSignedFixture();

    const result = await signBitcoinTransaction(vault, crypto, {
      network: "bitcoin-testnet",
      transaction,
    });

    expect(result).not.toHaveProperty("mnemonic");
    expect(result).not.toHaveProperty("seed");
    expect(result).not.toHaveProperty("privateKey");
    expect(result.txid).toMatch(/^[0-9a-f]{64}$/);

    expect(vault.get(MNEMONIC_STORAGE_KEY)).not.toBeNull();
  });

  it("rejects signing when an input belongs to another address", async () => {
    const { crypto, vault, transaction } = await createSignedFixture();

    const foreignTransaction = {
      ...transaction,
      inputs: [
        {
          ...transaction.inputs[0]!,
          previousOutput: {
            ...transaction.inputs[0]!.previousOutput,
            scriptPubKey: new Uint8Array([0x00, 0x14, ...new Array(20).fill(0xff)]),
          },
        },
      ],
    };

    await expect(
      signBitcoinTransaction(vault, crypto, {
        network: "bitcoin-testnet",
        transaction: foreignTransaction,
        addressType: "native-segwit",
        account: 0,
        change: 0,
        addressIndex: 0,
      }),
    ).rejects.toThrow("Bitcoin transaction input does not belong to the wallet");
  });
});
