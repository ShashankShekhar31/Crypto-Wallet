import {
  Bip32WalletKeyDeriver,
  Bip39MnemonicService,
  createBip44DerivationPath,
} from "@crypto-wallet/crypto";

import { describe, expect, it } from "vitest";

import { p2wpkh, Transaction } from "@scure/btc-signer";

import { createBitcoinPsbt, signBitcoinPsbt } from "../psbt.js";
import { createBitcoinTransaction } from "../transaction.js";

describe("bitcoin psbt", () => {
  it("creates a native SegWit PSBT from a Bitcoin transaction", () => {
    const previousScript = new Uint8Array([0x00, 0x14, ...new Uint8Array(20).fill(0x11)]);

    const recipientScript = new Uint8Array([0x00, 0x14, ...new Uint8Array(20).fill(0x22)]);

    const transaction = createBitcoinTransaction({
      network: "bitcoin-mainnet",
      version: 2,
      inputs: [
        {
          previousTxid: "0000000000000000000000000000000000000000000000000000000000000001",
          previousOutputIndex: 0,
          scriptSig: new Uint8Array(),
          sequence: 0xffffffff,
          previousOutput: {
            value: 100_000n,
            scriptPubKey: previousScript,
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

    const psbt = createBitcoinPsbt(transaction);

    expect(psbt.serialized).toBeInstanceOf(Uint8Array);
    expect(psbt.serialized.length).toBeGreaterThan(0);

    const parsed = Transaction.fromPSBT(psbt.serialized);

    expect(parsed.version).toBe(2);
    expect(parsed.lockTime).toBe(0);
    expect(parsed.inputsLength).toBe(1);
    expect(parsed.outputsLength).toBe(1);
  });

  it("preserves input amount and previous output script", () => {
    const previousScript = new Uint8Array([0x00, 0x14, ...new Uint8Array(20).fill(0x11)]);

    const recipientScript = new Uint8Array([0x00, 0x14, ...new Uint8Array(20).fill(0x22)]);

    const transaction = createBitcoinTransaction({
      network: "bitcoin-mainnet",
      version: 2,
      inputs: [
        {
          previousTxid: "0000000000000000000000000000000000000000000000000000000000000001",
          previousOutputIndex: 0,
          scriptSig: new Uint8Array(),
          sequence: 0xfffffffe,
          previousOutput: {
            value: 100_000n,
            scriptPubKey: previousScript,
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

    const psbt = createBitcoinPsbt(transaction);
    const parsed = Transaction.fromPSBT(psbt.serialized);

    const input = parsed.getInput(0);

    expect(input.witnessUtxo?.amount).toBe(100_000n);
    expect(input.witnessUtxo?.script).toEqual(previousScript);
  });

  it("preserves the transaction output", () => {
    const previousScript = new Uint8Array([0x00, 0x14, ...new Uint8Array(20).fill(0x11)]);

    const recipientScript = new Uint8Array([0x00, 0x14, ...new Uint8Array(20).fill(0x22)]);

    const transaction = createBitcoinTransaction({
      network: "bitcoin-mainnet",
      version: 2,
      inputs: [
        {
          previousTxid: "0000000000000000000000000000000000000000000000000000000000000001",
          previousOutputIndex: 0,
          scriptSig: new Uint8Array(),
          sequence: 0xffffffff,
          previousOutput: {
            value: 100_000n,
            scriptPubKey: previousScript,
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

    const psbt = createBitcoinPsbt(transaction);
    const parsed = Transaction.fromPSBT(psbt.serialized);

    const output = parsed.getOutput(0);

    expect(output.amount).toBe(90_000n);
    expect(output.script).toEqual(recipientScript);
  });

  it("does not mutate transaction script bytes", () => {
    const previousScript = new Uint8Array([0x00, 0x14, ...new Uint8Array(20).fill(0x11)]);

    const recipientScript = new Uint8Array([0x00, 0x14, ...new Uint8Array(20).fill(0x22)]);

    const previousScriptBefore = new Uint8Array(previousScript);
    const recipientScriptBefore = new Uint8Array(recipientScript);

    const transaction = createBitcoinTransaction({
      network: "bitcoin-mainnet",
      version: 2,
      inputs: [
        {
          previousTxid: "0000000000000000000000000000000000000000000000000000000000000001",
          previousOutputIndex: 0,
          scriptSig: new Uint8Array(),
          sequence: 0xffffffff,
          previousOutput: {
            value: 100_000n,
            scriptPubKey: previousScript,
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

    createBitcoinPsbt(transaction);

    expect(previousScript).toEqual(previousScriptBefore);
    expect(recipientScript).toEqual(recipientScriptBefore);
  });

  it("signs and finalizes a native SegWit transaction", async () => {
    const mnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    const mnemonicService = new Bip39MnemonicService();
    const deriver = new Bip32WalletKeyDeriver();

    const seed = await mnemonicService.toSeed(mnemonic);

    try {
      const rootKey = deriver.fromSeed(seed);

      try {
        const addressKey = deriver.derive(rootKey, createBip44DerivationPath(84, 0, 0, 0, 0));

        try {
          const publicKey = addressKey.publicKey();

          const previousOutput = p2wpkh(publicKey);

          const recipientScript = new Uint8Array([0x00, 0x14, ...new Uint8Array(20).fill(0x22)]);

          const transaction = createBitcoinTransaction({
            network: "bitcoin-mainnet",
            version: 2,
            inputs: [
              {
                previousTxid: "0000000000000000000000000000000000000000000000000000000000000001",
                previousOutputIndex: 0,
                scriptSig: new Uint8Array(),
                sequence: 0xffffffff,
                previousOutput: {
                  value: 100_000n,
                  scriptPubKey: previousOutput.script,
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

          const psbt = createBitcoinPsbt(transaction);

          const signed = signBitcoinPsbt(psbt.serialized, addressKey);

          expect(signed).toBeInstanceOf(Uint8Array);
          expect(signed.length).toBeGreaterThan(0);

          const extracted = Transaction.fromRaw(signed);

          expect(extracted.version).toBe(2);
          expect(extracted.inputsLength).toBe(1);
          expect(extracted.outputsLength).toBe(1);
          expect(extracted.hasWitnesses).toBe(true);
          expect(extracted.isFinal).toBe(true);
        } finally {
          addressKey.wipe();
        }
      } finally {
        rootKey.wipe();
      }
    } finally {
      seed.wipe();
    }
  });
});
