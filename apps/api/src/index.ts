import type {
  SupportedChain,
  WalletAccount,
} from "@crypto-wallet/shared-types";

export type ApiHealth = {
  status: "ok";
  supportedChains: SupportedChain[];
};

export const health: ApiHealth = {
  status: "ok",
  supportedChains: ["evm", "solana", "bitcoin"],
};

export type { WalletAccount };