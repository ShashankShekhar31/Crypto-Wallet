import { describe, expect, it } from "vitest";

import { decodeErc20Uint256, DefaultErc20BalanceReader, encodeErc20BalanceOf } from "../erc20.js";

import type { EvmRpcProvider } from "../rpc.js";

describe("ERC-20 helpers", () => {
  it("encodes balanceOf(address) calldata", () => {
    const address = "0x0000000000000000000000000000000000000001";

    expect(encodeErc20BalanceOf(address)).toBe(`0x70a08231${"0".repeat(24)}${address.slice(2)}`);
  });

  it("accepts mixed-case addresses", () => {
    const address = "0xAbCdEf0123456789aBcDeF0123456789aBcDeF01";

    expect(encodeErc20BalanceOf(address)).toBe(
      "0x70a08231000000000000000000000000AbCdEf0123456789aBcDeF0123456789aBcDeF01",
    );
  });

  it("rejects an invalid owner address", () => {
    expect(() => encodeErc20BalanceOf("not-an-address")).toThrow("Invalid EVM address");
  });

  it("decodes a uint256 balance into bigint", () => {
    expect(
      decodeErc20Uint256("0x000000000000000000000000000000000000000000000000000000000000002a"),
    ).toBe(42n);
  });

  it("decodes a large uint256 balance", () => {
    expect(
      decodeErc20Uint256("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
    ).toBe(115792089237316195423570985008687907853269984665640564039457584007913129639935n);
  });

  it("rejects a result with the wrong length", () => {
    expect(() => decodeErc20Uint256("0x2a")).toThrow("Invalid ERC-20 balance response");
  });

  it("rejects a result without the 0x prefix", () => {
    expect(() =>
      decodeErc20Uint256("000000000000000000000000000000000000000000000000000000000000002a"),
    ).toThrow("Invalid ERC-20 balance response");
  });

  it("rejects non-hexadecimal result data", () => {
    expect(() =>
      decodeErc20Uint256("0x00000000000000000000000000000000000000000000000000000000000000gg"),
    ).toThrow("Invalid ERC-20 balance response");
  });
});

describe("DefaultErc20BalanceReader", () => {
  const tokenAddress = "0x0000000000000000000000000000000000000002";

  const ownerAddress = "0x0000000000000000000000000000000000000001";

  it("reads an ERC-20 balance through eth_call", async () => {
    const requests: Array<{
      method: string;
      params: readonly unknown[];
    }> = [];

    const provider: EvmRpcProvider = {
      networkId: "ethereum-mainnet",

      async request<TResponse>(method: string, params: readonly unknown[]): Promise<TResponse> {
        requests.push({
          method,
          params,
        });

        return "0x000000000000000000000000000000000000000000000000000000000000002a" as TResponse;
      },
    };

    const reader = new DefaultErc20BalanceReader(provider);

    const balance = await reader.getBalance(tokenAddress, ownerAddress);

    expect(balance).toBe(42n);

    expect(requests).toEqual([
      {
        method: "eth_call",
        params: [
          {
            to: tokenAddress,
            data: `0x70a08231${"0".repeat(24)}${ownerAddress.slice(2)}`,
          },
          "latest",
        ],
      },
    ]);
  });

  it("accepts an explicit block tag", async () => {
    let receivedParams: readonly unknown[] | undefined;

    const provider: EvmRpcProvider = {
      networkId: "ethereum-mainnet",

      async request<TResponse>(_method: string, params: readonly unknown[]): Promise<TResponse> {
        receivedParams = params;

        return "0x0000000000000000000000000000000000000000000000000000000000000064" as TResponse;
      },
    };

    const reader = new DefaultErc20BalanceReader(provider);

    const balance = await reader.getBalance(tokenAddress, ownerAddress, "0x123456");

    expect(balance).toBe(100n);

    expect(receivedParams).toEqual([
      {
        to: tokenAddress,
        data: `0x70a08231${"0".repeat(24)}${ownerAddress.slice(2)}`,
      },
      "0x123456",
    ]);
  });

  it("rejects an invalid token address before RPC", async () => {
    let requestCount = 0;

    const provider: EvmRpcProvider = {
      networkId: "ethereum-mainnet",

      async request<TResponse>(): Promise<TResponse> {
        requestCount += 1;
        return "0x0" as TResponse;
      },
    };

    const reader = new DefaultErc20BalanceReader(provider);

    await expect(reader.getBalance("not-a-token", ownerAddress)).rejects.toThrow(
      "Invalid EVM address",
    );

    expect(requestCount).toBe(0);
  });

  it("rejects an invalid owner address before RPC", async () => {
    let requestCount = 0;

    const provider: EvmRpcProvider = {
      networkId: "ethereum-mainnet",

      async request<TResponse>(): Promise<TResponse> {
        requestCount += 1;
        return "0x0" as TResponse;
      },
    };

    const reader = new DefaultErc20BalanceReader(provider);

    await expect(reader.getBalance(tokenAddress, "invalid-owner")).rejects.toThrow(
      "Invalid EVM address",
    );

    expect(requestCount).toBe(0);
  });

  it("rejects an empty block tag", async () => {
    const provider: EvmRpcProvider = {
      networkId: "ethereum-mainnet",

      async request<TResponse>(): Promise<TResponse> {
        return "0x0" as TResponse;
      },
    };

    const reader = new DefaultErc20BalanceReader(provider);

    await expect(reader.getBalance(tokenAddress, ownerAddress, " ")).rejects.toThrow(
      "EVM block tag is required",
    );
  });

  it("rejects an invalid ERC-20 response", async () => {
    const provider: EvmRpcProvider = {
      networkId: "ethereum-mainnet",

      async request<TResponse>(): Promise<TResponse> {
        return "0x2a" as TResponse;
      },
    };

    const reader = new DefaultErc20BalanceReader(provider);

    await expect(reader.getBalance(tokenAddress, ownerAddress)).rejects.toThrow(
      "Invalid ERC-20 balance response",
    );
  });
});
