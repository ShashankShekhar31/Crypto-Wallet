import type { BitcoinNetworkId } from "./types.js";

export function getBitcoinTransactionExplorerUrl(network: BitcoinNetworkId, txid: string): string {
  if (!/^[0-9a-fA-F]{64}$/.test(txid)) {
    throw new Error("Invalid Bitcoin transaction ID");
  }

  const normalizedTxid = txid.toLowerCase();

  if (network === "bitcoin-mainnet") {
    return `https://mempool.space/tx/${normalizedTxid}`;
  }

  return `https://mempool.space/testnet/tx/${normalizedTxid}`;
}
