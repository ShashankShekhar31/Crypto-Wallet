import { describe, expect, it, vi } from "vitest";

import { DefaultSolanaBlockhashReader } from "../blockhash.js";

import type { SolanaRpcProvider } from "../rpc.js";

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

describe("DefaultSolanaBlockhashReader", () => {
  it("reads the latest blockhash", async () => {
    const request = createRequest();

    request.mockResolvedValue({
      context: {
        slot: 123456,
      },
      value: {
        blockhash: "EkSn1Z7w3qK6s7J7wVYQW7fY6Y9J5u4p",
        lastValidBlockHeight: 200000,
      },
    });

    const reader = new DefaultSolanaBlockhashReader(createProvider(request));

    const result = await reader.getLatestBlockhash();

    expect(result).toEqual({
      blockhash: "EkSn1Z7w3qK6s7J7wVYQW7fY6Y9J5u4p",
      lastValidBlockHeight: 200000,
    });

    expect(request).toHaveBeenCalledWith("getLatestBlockhash", [
      {
        commitment: "confirmed",
      },
    ]);
  });

  it("trims the blockhash", async () => {
    const request = createRequest();

    request.mockResolvedValue({
      value: {
        blockhash: "  EkSn1Z7w3qK6s7J7wVYQW7fY6Y9J5u4p  ",
        lastValidBlockHeight: 100,
      },
    });

    const reader = new DefaultSolanaBlockhashReader(createProvider(request));

    const result = await reader.getLatestBlockhash();

    expect(result.blockhash).toBe("EkSn1Z7w3qK6s7J7wVYQW7fY6Y9J5u4p");
  });

  it("rejects a missing response", async () => {
    const request = createRequest();

    request.mockResolvedValue(null);

    const reader = new DefaultSolanaBlockhashReader(createProvider(request));

    await expect(reader.getLatestBlockhash()).rejects.toThrow(
      "Invalid Solana latest blockhash response",
    );
  });

  it("rejects a response without a value", async () => {
    const request = createRequest();

    request.mockResolvedValue({
      context: {
        slot: 100,
      },
    });

    const reader = new DefaultSolanaBlockhashReader(createProvider(request));

    await expect(reader.getLatestBlockhash()).rejects.toThrow(
      "Invalid Solana latest blockhash response",
    );
  });

  it("rejects an empty blockhash", async () => {
    const request = createRequest();

    request.mockResolvedValue({
      value: {
        blockhash: "   ",
        lastValidBlockHeight: 100,
      },
    });

    const reader = new DefaultSolanaBlockhashReader(createProvider(request));

    await expect(reader.getLatestBlockhash()).rejects.toThrow(
      "Invalid Solana latest blockhash value",
    );
  });

  it("rejects a non-string blockhash", async () => {
    const request = createRequest();

    request.mockResolvedValue({
      value: {
        blockhash: 12345,
        lastValidBlockHeight: 100,
      },
    });

    const reader = new DefaultSolanaBlockhashReader(createProvider(request));

    await expect(reader.getLatestBlockhash()).rejects.toThrow(
      "Invalid Solana latest blockhash value",
    );
  });

  it("rejects a negative last valid block height", async () => {
    const request = createRequest();

    request.mockResolvedValue({
      value: {
        blockhash: "EkSn1Z7w3qK6s7J7wVYQW7fY6Y9J5u4p",
        lastValidBlockHeight: -1,
      },
    });

    const reader = new DefaultSolanaBlockhashReader(createProvider(request));

    await expect(reader.getLatestBlockhash()).rejects.toThrow(
      "Invalid Solana last valid block height",
    );
  });

  it("rejects a non-integer last valid block height", async () => {
    const request = createRequest();

    request.mockResolvedValue({
      value: {
        blockhash: "EkSn1Z7w3qK6s7J7wVYQW7fY6Y9J5u4p",
        lastValidBlockHeight: 100.5,
      },
    });

    const reader = new DefaultSolanaBlockhashReader(createProvider(request));

    await expect(reader.getLatestBlockhash()).rejects.toThrow(
      "Invalid Solana last valid block height",
    );
  });

  it("rejects an unsafe last valid block height", async () => {
    const request = createRequest();

    request.mockResolvedValue({
      value: {
        blockhash: "EkSn1Z7w3qK6s7J7wVYQW7fY6Y9J5u4p",
        lastValidBlockHeight: Number.MAX_SAFE_INTEGER + 1,
      },
    });

    const reader = new DefaultSolanaBlockhashReader(createProvider(request));

    await expect(reader.getLatestBlockhash()).rejects.toThrow(
      "Invalid Solana last valid block height",
    );
  });

  it("propagates provider errors", async () => {
    const request = createRequest();

    request.mockRejectedValue(new Error("RPC unavailable"));

    const reader = new DefaultSolanaBlockhashReader(createProvider(request));

    await expect(reader.getLatestBlockhash()).rejects.toThrow("RPC unavailable");
  });

  it("returns an immutable result", async () => {
    const request = createRequest();

    request.mockResolvedValue({
      value: {
        blockhash: "EkSn1Z7w3qK6s7J7wVYQW7fY6Y9J5u4p",
        lastValidBlockHeight: 100,
      },
    });

    const reader = new DefaultSolanaBlockhashReader(createProvider(request));

    const result = await reader.getLatestBlockhash();

    expect(Object.isFrozen(result)).toBe(true);
  });
});
