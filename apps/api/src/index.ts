import type {
  SupportedChain,
  WalletAccount,
} from "@crypto-wallet/shared-types";

import { loadConfig } from "@crypto-wallet/config";

export type ApiHealth = {
  status: "ok";
  environment: string;
  supportedChains: SupportedChain[];
};

export const config = loadConfig();

export const health: ApiHealth = {
  status: "ok",
  environment: config.environment,
  supportedChains: ["evm", "solana", "bitcoin"],
};

export type { WalletAccount };