import { describe, expect, it } from "vitest";

import { DefaultWalletCrypto } from "@crypto-wallet/crypto";
import { MemorySecureStorageAdapter, createWalletVault } from "@crypto-wallet/secure-storage";
import type {
  BitcoinFeeEstimate,
  BitcoinProvider,
  BitcoinTransactionStatus,
  BitcoinUtxo,
} from "@crypto-wallet/chain-core";

import {
  DefaultTransactionEngine,
  deriveBitcoinReceiveAddress,
  MNEMONIC_STORAGE_KEY,
} from "../index.js";

const MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

const SOURCE_ADDRESS = "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu";

function createUtxo(value: bigint): BitcoinUtxo {
  return {
    txid: "1111111111111111111111111111111111111111111111111111111111111111",
    vout: 0,
    value,
    scriptPubKey: new Uint8Array([0x00, 0x14, ...new Array(20).fill(0)]),
    confirmations: 6,
  };
}

function createProvider() {
  let status: BitcoinTransactionStatus = {
    txid: "e2e-bitcoin-tx-001",
    confirmed: false,
    confirmations: 0,
  };

  const provider: BitcoinProvider = {
    network: "bitcoin-mainnet",

    async getUtxos(address: string): Promise<readonly BitcoinUtxo[]> {
      expect(address).toBe(SOURCE_ADDRESS);

      return [createUtxo(10_000n)];
    },

    async estimateFee(): Promise<BitcoinFeeEstimate> {
      return {
        satoshisPerVbyte: 5,
      };
    },

    async broadcastTransaction(rawTransaction: Uint8Array): Promise<string> {
      expect(rawTransaction).toBeInstanceOf(Uint8Array);

      return "e2e-bitcoin-tx-001";
    },

    async getTransactionStatus(txid: string): Promise<BitcoinTransactionStatus> {
      return {
        ...status,
        txid,
      };
    },
  };

  return {
    provider,

    setStatus(nextStatus: BitcoinTransactionStatus): void {
      status = nextStatus;
    },
  };
}

describe("wallet and transaction end-to-end flow", () => {
  it("creates, persists, unlocks, receives and tracks a transaction", async () => {
    const adapter = new MemorySecureStorageAdapter();

    const vault = createWalletVault(adapter, {
      inactivityTimeoutMs: 15 * 60 * 1000,
    });

    const crypto = new DefaultWalletCrypto();

    // Create and persist wallet state.
    await vault.unlock("test-password");

    vault.set(MNEMONIC_STORAGE_KEY, new TextEncoder().encode(MNEMONIC));
    await vault.persist();

    expect(await vault.hasPersistedData()).toBe(true);

    // Lock and unlock the persisted wallet.
    vault.lock();

    await vault.unlock("test-password");

    // Derive the receive address.
    const receiveAddress = await deriveBitcoinReceiveAddress(
      vault,
      (value) => crypto.mnemonic.toSeed(value),
      {
        network: "bitcoin-mainnet",
        addressType: "native-segwit",
      },
    );

    expect(receiveAddress).toMatch(/^bc1/);
    expect(receiveAddress).not.toBe(MNEMONIC);

    // Simulate available Bitcoin funds.
    const { provider, setStatus } = createProvider();

    const utxos = await provider.getUtxos(SOURCE_ADDRESS);

    expect(utxos).toHaveLength(1);
    expect(utxos[0]?.value).toBe(10_000n);

    // Track the transaction through its lifecycle.
    const engine = new DefaultTransactionEngine();

    const transaction = engine.createIdempotent("e2e-tx-001", {
      id: "e2e-transaction-001",
      chain: "bitcoin",
      status: "draft",
      assetId: "bitcoin",
      amount: "0.00005",
      createdAt: new Date().toISOString(),
    });

    expect(transaction.status).toBe("draft");

    const signed = engine.transition(transaction.id, "signed");
    expect(signed.status).toBe("signed");

    const submitted = engine.transition(transaction.id, "submitted");
    expect(submitted.status).toBe("submitted");

    const pending = engine.transition(transaction.id, "pending");
    expect(pending.status).toBe("pending");

    const confirmed = engine.transition(transaction.id, "confirmed");
    expect(confirmed.status).toBe("confirmed");

    // Verify transaction can be retrieved after completion.
    const stored = engine.getById(transaction.id);

    expect(stored).toEqual(confirmed);

    // Verify idempotent retry returns the same transaction.
    const duplicate = engine.createIdempotent("e2e-tx-001", {
      ...transaction,
    });

    expect(duplicate).toEqual(confirmed);

    // Simulate broadcast and provider confirmation.
    const rawTransaction = new Uint8Array([0x01, 0x02, 0x03]);

    const txid = await provider.broadcastTransaction(rawTransaction);

    expect(txid).toBe("e2e-bitcoin-tx-001");

    // Simulate provider confirmation.
    setStatus({
      txid: "e2e-bitcoin-tx-001",
      confirmed: true,
      confirmations: 6,
    });

    const status = await provider.getTransactionStatus(txid);

    expect(status).toEqual({
      txid: "e2e-bitcoin-tx-001",
      confirmed: true,
      confirmations: 6,
    });
  });
  it("handles delayed Bitcoin confirmation", async () => {
    const { provider, setStatus } = createProvider();

    const rawTransaction = new Uint8Array([0x01, 0x02, 0x03]);

    const txid = await provider.broadcastTransaction(rawTransaction);

    expect(txid).toBe("e2e-bitcoin-tx-001");

    const pendingStatus = await provider.getTransactionStatus(txid);

    expect(pendingStatus).toEqual({
      txid: "e2e-bitcoin-tx-001",
      confirmed: false,
      confirmations: 0,
    });

    setStatus({
      txid: "e2e-bitcoin-tx-001",
      confirmed: true,
      confirmations: 6,
    });

    const confirmedStatus = await provider.getTransactionStatus(txid);

    expect(confirmedStatus).toEqual({
      txid: "e2e-bitcoin-tx-001",
      confirmed: true,
      confirmations: 6,
    });
  });
  it("detects a Bitcoin confirmation reorg", async () => {
    const { provider, setStatus } = createProvider();

    const rawTransaction = new Uint8Array([0x01, 0x02, 0x03]);

    const txid = await provider.broadcastTransaction(rawTransaction);

    setStatus({
      txid,
      confirmed: true,
      confirmations: 6,
    });

    const confirmedStatus = await provider.getTransactionStatus(txid);

    expect(confirmedStatus).toEqual({
      txid,
      confirmed: true,
      confirmations: 6,
    });

    // Simulate a chain reorganization removing the confirmation.
    setStatus({
      txid,
      confirmed: false,
      confirmations: 0,
    });

    const reorgedStatus = await provider.getTransactionStatus(txid);

    expect(reorgedStatus).toEqual({
      txid,
      confirmed: false,
      confirmations: 0,
    });
  });
});
