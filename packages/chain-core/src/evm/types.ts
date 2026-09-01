export interface EvmNativeCurrency {
  readonly name: string;
  readonly symbol: string;
  readonly decimals: number;
}

export interface EvmNetworkConfig {
  readonly id: string;
  readonly name: string;
  readonly chainId: bigint;
  readonly nativeCurrency: EvmNativeCurrency;
  readonly rpcUrls: readonly string[];
}
