import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  DefaultSolanaSplBalanceReader,
} from "../spl-balance.js";

import type {
  SolanaRpcProvider,
} from "../rpc.js";

const VALID_OWNER =
  "11111111111111111111111111111111";

const VALID_MINT =
  "So11111111111111111111111111111111111111112";

type RequestMock = ReturnType<typeof vi.fn>;

function createProvider(
  request: RequestMock,
): SolanaRpcProvider {
  return {
    networkId: "solana-testnet",
    request:
      request as unknown as SolanaRpcProvider["request"],
  };
}

function createRequest() {
  return vi.fn(
    async (
      _method: string,
      _params?: readonly unknown[],
    ): Promise<unknown> => {
      return undefined;
    },
  );
}

function createTokenAccount(
  amount: string,
  decimals = 9,
  mint = VALID_MINT,
) {
  return {
    pubkey:
      "11111111111111111111111111111111",
    account: {
      data: {
        parsed: {
          info: {
            mint,
            tokenAmount: {
              amount,
              decimals,
              uiAmount: Number(amount) /
                10 ** decimals,
              uiAmountString: "0",
            },
          },
          type: "account",
        },
        program: "spl-token",
        space: 165,
      },
    },
  };
}

describe(
  "DefaultSolanaSplBalanceReader",
  () => {
    it("reads an SPL token balance", async () => {
      const request = createRequest();

      request.mockResolvedValue({
        value: [
          createTokenAccount(
            "1500000000",
            9,
          ),
        ],
      });

      const reader =
        new DefaultSolanaSplBalanceReader(
          createProvider(request),
        );

      const result =
        await reader.getBalance(
          VALID_OWNER,
          VALID_MINT,
        );

      expect(result).toEqual({
        mint: VALID_MINT,
        amount: 1_500_000_000n,
        decimals: 9,
      });

      expect(request).toHaveBeenCalledWith(
        "getTokenAccountsByOwner",
        [
          VALID_OWNER,
          {
            mint: VALID_MINT,
          },
          {
            commitment: "confirmed",
            encoding: "jsonParsed",
          },
        ],
      );
    });

    it("trims owner and mint addresses", async () => {
      const request = createRequest();

      request.mockResolvedValue({
        value: [
          createTokenAccount(
            "500",
            6,
          ),
        ],
      });

      const reader =
        new DefaultSolanaSplBalanceReader(
          createProvider(request),
        );

      const result =
        await reader.getBalance(
          `  ${VALID_OWNER}  `,
          `  ${VALID_MINT}  `,
        );

      expect(result).toEqual({
        mint: VALID_MINT,
        amount: 500n,
        decimals: 6,
      });

      expect(request).toHaveBeenCalledWith(
        "getTokenAccountsByOwner",
        [
          VALID_OWNER,
          {
            mint: VALID_MINT,
          },
          {
            commitment: "confirmed",
            encoding: "jsonParsed",
          },
        ],
      );
    });

    it("sums multiple token accounts", async () => {
      const request = createRequest();

      request.mockResolvedValue({
        value: [
          createTokenAccount(
            "1500000000",
            9,
          ),
          createTokenAccount(
            "2500000000",
            9,
          ),
        ],
      });

      const reader =
        new DefaultSolanaSplBalanceReader(
          createProvider(request),
        );

      const result =
        await reader.getBalance(
          VALID_OWNER,
          VALID_MINT,
        );

      expect(result.amount).toBe(
        4_000_000_000n,
      );

      expect(result.decimals).toBe(9);
    });

    it("returns zero for no token accounts", async () => {
      const request = createRequest();

      request.mockResolvedValue({
        value: [],
      });

      const reader =
        new DefaultSolanaSplBalanceReader(
          createProvider(request),
        );

      const result =
        await reader.getBalance(
          VALID_OWNER,
          VALID_MINT,
        );

      expect(result).toEqual({
        mint: VALID_MINT,
        amount: 0n,
        decimals: 0,
      });
    });

    it("rejects an invalid owner address", async () => {
      const request = createRequest();

      const reader =
        new DefaultSolanaSplBalanceReader(
          createProvider(request),
        );

      await expect(
        reader.getBalance(
          "not-a-solana-address",
          VALID_MINT,
        ),
      ).rejects.toThrow(
        "Invalid Solana address",
      );

      expect(request).not.toHaveBeenCalled();
    });

    it("rejects an invalid mint address", async () => {
      const request = createRequest();

      const reader =
        new DefaultSolanaSplBalanceReader(
          createProvider(request),
        );

      await expect(
        reader.getBalance(
          VALID_OWNER,
          "not-a-solana-address",
        ),
      ).rejects.toThrow(
        "Invalid Solana address",
      );

      expect(request).not.toHaveBeenCalled();
    });

    it("rejects an invalid response", async () => {
      const request = createRequest();

      request.mockResolvedValue(null);

      const reader =
        new DefaultSolanaSplBalanceReader(
          createProvider(request),
        );

      await expect(
        reader.getBalance(
          VALID_OWNER,
          VALID_MINT,
        ),
      ).rejects.toThrow(
        "Invalid Solana SPL token balance response",
      );
    });

    it("rejects an invalid token amount", async () => {
      const request = createRequest();

      request.mockResolvedValue({
        value: [
          createTokenAccount(
            "not-a-number",
            9,
          ),
        ],
      });

      const reader =
        new DefaultSolanaSplBalanceReader(
          createProvider(request),
        );

      await expect(
        reader.getBalance(
          VALID_OWNER,
          VALID_MINT,
        ),
      ).rejects.toThrow(
        "Invalid Solana SPL token amount",
      );
    });

    it("rejects invalid decimals", async () => {
      const request = createRequest();

      request.mockResolvedValue({
        value: [
          createTokenAccount(
            "100",
            -1,
          ),
        ],
      });

      const reader =
        new DefaultSolanaSplBalanceReader(
          createProvider(request),
        );

      await expect(
        reader.getBalance(
          VALID_OWNER,
          VALID_MINT,
        ),
      ).rejects.toThrow(
        "Invalid Solana SPL token decimals",
      );
    });

    it("rejects inconsistent decimals", async () => {
      const request = createRequest();

      request.mockResolvedValue({
        value: [
          createTokenAccount(
            "100",
            6,
          ),
          createTokenAccount(
            "200",
            9,
          ),
        ],
      });

      const reader =
        new DefaultSolanaSplBalanceReader(
          createProvider(request),
        );

      await expect(
        reader.getBalance(
          VALID_OWNER,
          VALID_MINT,
        ),
      ).rejects.toThrow(
        "Inconsistent Solana SPL token decimals",
      );
    });

    it("propagates provider errors", async () => {
      const request = createRequest();

      request.mockRejectedValue(
        new Error("RPC unavailable"),
      );

      const reader =
        new DefaultSolanaSplBalanceReader(
          createProvider(request),
        );

      await expect(
        reader.getBalance(
          VALID_OWNER,
          VALID_MINT,
        ),
      ).rejects.toThrow(
        "RPC unavailable",
      );
    });

    it("returns an immutable result", async () => {
      const request = createRequest();

      request.mockResolvedValue({
        value: [
          createTokenAccount(
            "100",
            9,
          ),
        ],
      });

      const reader =
        new DefaultSolanaSplBalanceReader(
          createProvider(request),
        );

      const result =
        await reader.getBalance(
          VALID_OWNER,
          VALID_MINT,
        );

      expect(
        Object.isFrozen(result),
      ).toBe(true);
    });
  },
);