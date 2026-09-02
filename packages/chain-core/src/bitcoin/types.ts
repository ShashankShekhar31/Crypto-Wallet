export type BitcoinNetworkId = "bitcoin-mainnet" | "bitcoin-testnet";

export interface BitcoinNetworkConfig {
  readonly id: BitcoinNetworkId;
  readonly name: string;
  readonly bech32Hrp: string;
  readonly bip44CoinType: number;
}
