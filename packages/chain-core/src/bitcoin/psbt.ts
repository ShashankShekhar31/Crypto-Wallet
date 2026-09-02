import { hex } from "@scure/base";
import { Transaction } from "@scure/btc-signer";
import type { DerivedKey } from "@crypto-wallet/crypto";

import type { BitcoinTransaction } from "./transaction.js";

export interface BitcoinPsbt {
  readonly serialized: Uint8Array;
}

export function createBitcoinPsbt(transaction: BitcoinTransaction): BitcoinPsbt {
  if (transaction.inputs.length === 0) {
    throw new Error("Bitcoin transaction must contain at least one input");
  }

  if (transaction.outputs.length === 0) {
    throw new Error("Bitcoin transaction must contain at least one output");
  }

  const tx = new Transaction({
    version: transaction.version,
    lockTime: transaction.lockTime,
    PSBTVersion: 0,
  });

  for (const input of transaction.inputs) {
    tx.addInput({
      txid: hex.decode(input.previousTxid),
      index: input.previousOutputIndex,
      sequence: input.sequence,
      witnessUtxo: {
        amount: input.previousOutput.value,
        script: new Uint8Array(input.previousOutput.scriptPubKey),
      },
    });
  }

  for (const output of transaction.outputs) {
    tx.addOutput({
      amount: output.value,
      script: new Uint8Array(output.scriptPubKey),
    });
  }

  return Object.freeze({
    serialized: new Uint8Array(tx.toPSBT()),
  });
}

export function signBitcoinPsbt(serialized: Uint8Array, key: DerivedKey): Uint8Array {
  const transaction = Transaction.fromPSBT(new Uint8Array(serialized));

  const privateKey = key.privateKey();

  try {
    const privateKeyBytes = privateKey.copy();

    try {
      transaction.sign(privateKeyBytes);
      transaction.finalize();

      return new Uint8Array(transaction.extract());
    } finally {
      privateKeyBytes.fill(0);
    }
  } finally {
    privateKey.wipe();
  }
}
