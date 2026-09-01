import type { SolanaRpcProvider } from "./rpc.js";

export interface SolanaLatestBlockhash {
  readonly blockhash: string;
  readonly lastValidBlockHeight: number;
}

interface SolanaLatestBlockhashRpcResponse {
  readonly context?: {
    readonly slot?: unknown;
  };
  readonly value?: {
    readonly blockhash?: unknown;
    readonly lastValidBlockHeight?: unknown;
  };
}

export class DefaultSolanaBlockhashReader {
  private readonly provider: SolanaRpcProvider;

  constructor(provider: SolanaRpcProvider) {
    this.provider = provider;
  }

  async getLatestBlockhash(): Promise<SolanaLatestBlockhash> {
    const response =
      await this.provider.request<SolanaLatestBlockhashRpcResponse>(
        "getLatestBlockhash",
        [
          {
            commitment: "confirmed",
          },
        ],
      );

    if (
      typeof response !== "object" ||
      response === null ||
      typeof response.value !== "object" ||
      response.value === null
    ) {
      throw new Error(
        "Invalid Solana latest blockhash response",
      );
    }

    const blockhash = response.value.blockhash;

    if (
      typeof blockhash !== "string" ||
      !blockhash.trim()
    ) {
      throw new Error(
        "Invalid Solana latest blockhash value",
      );
    }

    const lastValidBlockHeight =
      response.value.lastValidBlockHeight;

    if (
      typeof lastValidBlockHeight !== "number" ||
      !Number.isSafeInteger(lastValidBlockHeight) ||
      lastValidBlockHeight < 0
    ) {
      throw new Error(
        "Invalid Solana last valid block height",
      );
    }

    return Object.freeze({
      blockhash: blockhash.trim(),
      lastValidBlockHeight,
    });
  }
}