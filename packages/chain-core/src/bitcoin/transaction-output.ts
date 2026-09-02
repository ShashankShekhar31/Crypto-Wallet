export interface BitcoinTransactionOutput {
  readonly value: bigint;
  readonly scriptPubKey: Uint8Array;
}

export interface BitcoinTransactionReader {
  getTransactionOutput(txid: string, vout: number): Promise<BitcoinTransactionOutput>;
}
