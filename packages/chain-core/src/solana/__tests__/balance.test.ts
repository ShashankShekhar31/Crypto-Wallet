import { describe, expect, it, vi } from "vitest";

import { DefaultSolanaBalanceReader } from "../balance.js";

import type { SolanaRpcProvider } from "../rpc.js";

const VALID_ADDRESS = "11111111111111111111111111111111";

type RequestMock = ReturnType<typeof vi.fn>;

function createProvider(request: RequestMock): SolanaRpcProvider {
  return {
    networkId: "solana-testnet",
    request: request as unknown as SolanaRpcProvider["request"],
  };
}

function createRequest() {
  return vi.fn(async (_method: string, _params?: readonly unknown[]): Promise<unknown> => {
    return undefined;
  });
}

describe("DefaultSolanaBalanceReader", () => {
  it("reads a native SOL balance", async () => {
    const request = createRequest();

    request.mockResolvedValue({
      context: {
        slot: 123456,
      },
      value: 1_500_000_000,
    });

    const reader = new DefaultSolanaBalanceReader(createProvider(request));

    const balance = await reader.getBalance(VALID_ADDRESS);

    expect(balance).toEqual({
      lamports: 1_500_000_000,
      slot: 123456,
    });

    expect(request).toHaveBeenCalledWith("getBalance", [
      VALID_ADDRESS,
      {
        commitment: "confirmed",
      },
    ]);
  });

  it("trims the wallet address", async () => {
    const request = createRequest();

    request.mockResolvedValue({
      context: {
        slot: 100,
      },
      value: 500,
    });

    const reader = new DefaultSolanaBalanceReader(createProvider(request));

    await reader.getBalance(`  ${VALID_ADDRESS}  `);

    expect(request).toHaveBeenCalledWith("getBalance", [
      VALID_ADDRESS,
      {
        commitment: "confirmed",
      },
    ]);
  });

  it("rejects an invalid address", async () => {
    const request = createRequest();

    const reader = new DefaultSolanaBalanceReader(createProvider(request));

    await expect(reader.getBalance("not-a-solana-address")).rejects.toThrow(
      "Invalid Solana address",
    );

    expect(request).not.toHaveBeenCalled();
  });

  it("rejects an empty address", async () => {
    const request = createRequest();

    const reader = new DefaultSolanaBalanceReader(createProvider(request));

    await expect(reader.getBalance("   ")).rejects.toThrow("Solana address is required");

    expect(request).not.toHaveBeenCalled();
  });
  it("propagates provider errors", async () => {
    const request = createRequest();

    request.mockRejectedValue(new Error("RPC unavailable"));

    const reader = new DefaultSolanaBalanceReader(createProvider(request));

    await expect(reader.getBalance(VALID_ADDRESS)).rejects.toThrow("RPC unavailable");
  });

  it("rejects an invalid response", async () => {
    const request = createRequest();

    request.mockResolvedValue(null);

    const reader = new DefaultSolanaBalanceReader(createProvider(request));

    await expect(reader.getBalance(VALID_ADDRESS)).rejects.toThrow(
      "Invalid Solana balance response",
    );
  });

  it("rejects an invalid response context", async () => {
    const request = createRequest();

    request.mockResolvedValue({
      context: {
        slot: -1,
      },
      value: 100,
    });

    const reader = new DefaultSolanaBalanceReader(createProvider(request));

    await expect(reader.getBalance(VALID_ADDRESS)).rejects.toThrow(
      "Invalid Solana balance response context",
    );
  });

  it("rejects a non-integer slot", async () => {
    const request = createRequest();

    request.mockResolvedValue({
      context: {
        slot: 12.5,
      },
      value: 100,
    });

    const reader = new DefaultSolanaBalanceReader(createProvider(request));

    await expect(reader.getBalance(VALID_ADDRESS)).rejects.toThrow(
      "Invalid Solana balance response context",
    );
  });

  it("rejects a negative balance", async () => {
    const request = createRequest();

    request.mockResolvedValue({
      context: {
        slot: 100,
      },
      value: -1,
    });

    const reader = new DefaultSolanaBalanceReader(createProvider(request));

    await expect(reader.getBalance(VALID_ADDRESS)).rejects.toThrow(
      "Invalid Solana balance response value",
    );
  });

  it("rejects a non-integer balance", async () => {
    const request = createRequest();

    request.mockResolvedValue({
      context: {
        slot: 100,
      },
      value: 1.5,
    });

    const reader = new DefaultSolanaBalanceReader(createProvider(request));

    await expect(reader.getBalance(VALID_ADDRESS)).rejects.toThrow(
      "Invalid Solana balance response value",
    );
  });
});
