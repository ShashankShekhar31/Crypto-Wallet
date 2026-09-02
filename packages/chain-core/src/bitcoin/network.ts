import type { BitcoinNetworkConfig, BitcoinNetworkId } from "./types.js";

const NETWORKS: Record<BitcoinNetworkId, BitcoinNetworkConfig> = {
  "bitcoin-mainnet": {
    id: "bitcoin-mainnet",
    name: "Bitcoin",
    bech32Hrp: "bc",
    bip44CoinType: 0,
  },

  "bitcoin-testnet": {
    id: "bitcoin-testnet",
    name: "Bitcoin Testnet",
    bech32Hrp: "tb",
    bip44CoinType: 1,
  },
};

export function createBitcoinNetworkConfig(id: BitcoinNetworkId): BitcoinNetworkConfig {
  const config = NETWORKS[id];

  if (!config) {
    throw new Error(`Unsupported Bitcoin network: ${id}`);
  }

  return Object.freeze({
    ...config,
  });
}
