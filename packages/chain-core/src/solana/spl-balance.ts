import { validateSolanaAddress } from "./address.js";
import type { SolanaRpcProvider } from "./rpc.js";

export interface SolanaSplBalance {
  readonly mint: string;
  readonly amount: bigint;
  readonly decimals: number;
}

export interface SolanaSplBalanceReader {
  getBalance(owner: string, mint: string): Promise<SolanaSplBalance>;
}

interface SolanaTokenAmountResponse {
  readonly amount: string;
  readonly decimals: number;
}

interface SolanaParsedTokenAccount {
  readonly account?: {
    readonly data?: {
      readonly parsed?: {
        readonly info?: {
          readonly mint?: unknown;
          readonly tokenAmount?: unknown;
        };
      };
    };
  };
}

interface SolanaTokenAccountsResponse {
  readonly value?: unknown;
}

function parseTokenAmount(value: unknown): SolanaTokenAmountResponse {
  if (typeof value !== "object" || value === null) {
    throw new Error("Invalid Solana SPL token amount");
  }

  const amount = "amount" in value ? value.amount : undefined;

  const decimals = "decimals" in value ? value.decimals : undefined;

  if (typeof amount !== "string" || !/^\d+$/.test(amount)) {
    throw new Error("Invalid Solana SPL token amount");
  }

  if (typeof decimals !== "number" || !Number.isSafeInteger(decimals) || decimals < 0) {
    throw new Error("Invalid Solana SPL token decimals");
  }

  return {
    amount,
    decimals,
  };
}

function parseResponse(response: unknown, mint: string): SolanaSplBalance {
  if (typeof response !== "object" || response === null || !("value" in response)) {
    throw new Error("Invalid Solana SPL token balance response");
  }

  const value = (response as SolanaTokenAccountsResponse).value;

  if (!Array.isArray(value)) {
    throw new Error("Invalid Solana SPL token balance response");
  }

  let totalAmount = 0n;
  let decimals: number | undefined;

  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) {
      throw new Error("Invalid Solana SPL token account");
    }

    const account = entry as SolanaParsedTokenAccount;

    const info = account.account?.data?.parsed?.info;

    if (typeof info !== "object" || info === null) {
      throw new Error("Invalid Solana SPL token account");
    }

    if (info.mint !== mint) {
      throw new Error("Invalid Solana SPL token mint");
    }

    const tokenAmount = parseTokenAmount(info.tokenAmount);

    if (decimals !== undefined && decimals !== tokenAmount.decimals) {
      throw new Error("Inconsistent Solana SPL token decimals");
    }

    decimals = tokenAmount.decimals;
    totalAmount += BigInt(tokenAmount.amount);
  }

  return Object.freeze({
    mint,
    amount: totalAmount,
    decimals: decimals ?? 0,
  });
}

export class DefaultSolanaSplBalanceReader implements SolanaSplBalanceReader {
  constructor(private readonly provider: SolanaRpcProvider) {}

  async getBalance(owner: string, mint: string): Promise<SolanaSplBalance> {
    const normalizedOwner = validateSolanaAddress(owner);

    const normalizedMint = validateSolanaAddress(mint);

    const response = await this.provider.request<unknown>("getTokenAccountsByOwner", [
      normalizedOwner,
      {
        mint: normalizedMint,
      },
      {
        commitment: "confirmed",
        encoding: "jsonParsed",
      },
    ]);

    return parseResponse(response, normalizedMint);
  }
}
