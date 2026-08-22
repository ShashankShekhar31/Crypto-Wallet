import type { SupportedChain } from "@crypto-wallet/shared-types";

export type ApiHealth = {
  status: "ok";
  environment: string;
  supportedChains: SupportedChain[];
};

export const health: ApiHealth = {
  status: "ok",
  environment: process.env.NODE_ENV?.trim() || "development",
  supportedChains: ["evm", "solana", "bitcoin"],
};
