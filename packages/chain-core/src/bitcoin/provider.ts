import type { BitcoinNetworkId } from "./types.js";

export interface BitcoinUtxo {
  readonly txid: string;
  readonly vout: number;
  readonly value: bigint;
  readonly scriptPubKey: Uint8Array;
  readonly confirmations: number;
}

export interface BitcoinTransactionStatus {
  readonly txid: string;
  readonly confirmed: boolean;
  readonly confirmations: number;
  readonly blockHeight?: number;
  readonly blockHash?: string;
}

export interface BitcoinFeeEstimate {
  readonly satoshisPerVbyte: number;
}

export interface BitcoinProvider {
  readonly network: BitcoinNetworkId;

  getUtxos(address: string): Promise<readonly BitcoinUtxo[]>;

  estimateFee(): Promise<BitcoinFeeEstimate>;

  broadcastTransaction(rawTransaction: Uint8Array): Promise<string>;

  getTransactionStatus(txid: string): Promise<BitcoinTransactionStatus>;
}

export interface BitcoinProvider {
  getUtxos(address: string): Promise<readonly BitcoinUtxo[]>;

  estimateFee(): Promise<BitcoinFeeEstimate>;

  broadcastTransaction(rawTransaction: Uint8Array): Promise<string>;
}
