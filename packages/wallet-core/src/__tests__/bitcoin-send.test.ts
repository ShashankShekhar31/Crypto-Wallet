import { describe, expect, it } from "vitest";

import { DefaultWalletCrypto } from "@crypto-wallet/crypto";
import { MemorySecureStorageAdapter, createWalletVault } from "@crypto-wallet/secure-storage";

import type {
  BitcoinFeeEstimate,
  BitcoinProvider,
  BitcoinTransactionStatus,
  BitcoinUtxo,
} from "@crypto-wallet/chain-core";

import { createBitcoinSendPreview, type BitcoinSendRequest } from "../bitcoin-send.js";

import { MNEMONIC_STORAGE_KEY } from "../wallet-lifecycle.js";

const MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

const SOURCE_ADDRESS = "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu";

const RECIPIENT_ADDRESS = "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu";

function createUtxo(value: bigint): BitcoinUtxo {
  return {
    txid: "1111111111111111111111111111111111111111111111111111111111111111",
    vout: 0,
    value,
    scriptPubKey: new Uint8Array([0x00, 0x14, ...new Array(20).fill(0)]),
    confirmations: 6,
  };
}

function createProvider(utxos: readonly BitcoinUtxo[] = [createUtxo(10_000n)]): BitcoinProvider {
  return {
    network: "bitcoin-mainnet",

    async getUtxos(address: string): Promise<readonly BitcoinUtxo[]> {
      expect(address).toBe(SOURCE_ADDRESS);
      return utxos;
    },

    async estimateFee(): Promise<BitcoinFeeEstimate> {
      return {
        satoshisPerVbyte: 5,
      };
    },

    async broadcastTransaction(): Promise<string> {
      throw new Error("not implemented");
    },

    async getTransactionStatus(_txid: string): Promise<BitcoinTransactionStatus> {
      throw new Error("not implemented");
    },
  };
}

async function createUnlockedVault() {
  const adapter = new MemorySecureStorageAdapter();

  const vault = createWalletVault(adapter, {
    inactivityTimeoutMs: 15 * 60 * 1000,
  });

  await vault.unlock("test-password");

  vault.set(MNEMONIC_STORAGE_KEY, new TextEncoder().encode(MNEMONIC));

  return vault;
}

function createRequest(provider: BitcoinProvider): BitcoinSendRequest {
  return {
    provider,
    network: "bitcoin-mainnet",
    recipient: RECIPIENT_ADDRESS,
    amount: 5_000n,
    addressType: "native-segwit",
  };
}

describe("Bitcoin send preview", () => {
  it("creates an unsigned transaction preview", async () => {
    const vault = await createUnlockedVault();
    const crypto = new DefaultWalletCrypto();
    const provider = createProvider();

    const preview = await createBitcoinSendPreview(vault, crypto, createRequest(provider));

    expect(preview.network).toBe("bitcoin-mainnet");
    expect(preview.sourceAddress).toBe(SOURCE_ADDRESS);
    expect(preview.recipientAddress).toBe(RECIPIENT_ADDRESS);
    expect(preview.amount).toBe(5_000n);

    expect(preview.fee).toBe(700n);
    expect(preview.change).toBe(4_300n);
    expect(preview.virtualSize).toBe(140);

    expect(preview.transaction.inputs).toHaveLength(1);
    expect(preview.transaction.outputs).toHaveLength(2);

    expect(preview.transaction.inputs[0]?.scriptSig).toHaveLength(0);
  });

  it("rejects an invalid recipient before provider access", async () => {
    const vault = await createUnlockedVault();
    const crypto = new DefaultWalletCrypto();

    let providerCalled = false;

    const provider = createProvider();
    const wrappedProvider: BitcoinProvider = {
      ...provider,
      async getUtxos(address: string) {
        providerCalled = true;
        return provider.getUtxos(address);
      },
    };

    await expect(
      createBitcoinSendPreview(vault, crypto, {
        ...createRequest(wrappedProvider),
        recipient: "not-a-bitcoin-address",
      }),
    ).rejects.toThrow("Invalid Bitcoin address");

    expect(providerCalled).toBe(false);
  });

  it("rejects a recipient from the wrong Bitcoin network", async () => {
    const vault = await createUnlockedVault();
    const crypto = new DefaultWalletCrypto();
    const provider = createProvider();

    await expect(
      createBitcoinSendPreview(vault, crypto, {
        ...createRequest(provider),
        recipient: "tb1qcr8te4kr609gcawutmrza0j4xv80jy8zmfp6l0",
      }),
    ).rejects.toThrow("Invalid Bitcoin address");
  });

  it("rejects insufficient Bitcoin funds", async () => {
    const vault = await createUnlockedVault();
    const crypto = new DefaultWalletCrypto();

    const provider = createProvider([createUtxo(5_000n)]);

    await expect(createBitcoinSendPreview(vault, crypto, createRequest(provider))).rejects.toThrow(
      "Insufficient Bitcoin funds",
    );
  });
});
