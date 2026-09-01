import { validateSolanaAddress } from "./address.js";
import type { SolanaRpcProvider } from "./rpc.js";

export interface SolanaBalance {
  readonly lamports: number;
  readonly slot: number;
}

export interface SolanaBalanceReader {
  getBalance(address: string): Promise<SolanaBalance>;
}

interface SolanaGetBalanceResponse {
  readonly context: {
    readonly slot: number;
  };
  readonly value: number;
}

export class DefaultSolanaBalanceReader implements SolanaBalanceReader {
  private readonly provider: SolanaRpcProvider;

  constructor(provider: SolanaRpcProvider) {
    this.provider = provider;
  }

  async getBalance(address: string): Promise<SolanaBalance> {
    const normalizedAddress = validateSolanaAddress(address);

    const response = await this.provider.request<SolanaGetBalanceResponse>("getBalance", [
      normalizedAddress,
      {
        commitment: "confirmed",
      },
    ]);

    if (!response || typeof response !== "object") {
      throw new Error("Invalid Solana balance response");
    }

    if (
      !response.context ||
      typeof response.context.slot !== "number" ||
      !Number.isSafeInteger(response.context.slot) ||
      response.context.slot < 0
    ) {
      throw new Error("Invalid Solana balance response context");
    }

    if (
      typeof response.value !== "number" ||
      !Number.isSafeInteger(response.value) ||
      response.value < 0
    ) {
      throw new Error("Invalid Solana balance response value");
    }

    return Object.freeze({
      lamports: response.value,
      slot: response.context.slot,
    });
  }
}
