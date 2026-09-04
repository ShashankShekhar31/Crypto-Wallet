import { Transaction } from "@scure/btc-signer";

export function getBitcoinTransactionId(rawTransaction: Uint8Array): string {
  if (rawTransaction.length === 0) {
    throw new Error("Bitcoin raw transaction cannot be empty");
  }

  const transaction = Transaction.fromRaw(new Uint8Array(rawTransaction));

  return transaction.id;
}
