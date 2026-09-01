export interface SolanaNetworkConfig {
  readonly id: string;
  readonly name: string;
  readonly rpcUrls: readonly string[];
  readonly commitment: SolanaCommitment;
  readonly genesisHash: string;
}

export type SolanaCommitment =
  | "processed"
  | "confirmed"
  | "finalized";