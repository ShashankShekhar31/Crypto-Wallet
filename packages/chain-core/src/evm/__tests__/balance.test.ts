import { describe, expect, it } from "vitest";

import { DefaultEvmBalanceReader, parseEvmQuantity } from "../balance.js";

import type { EvmRpcProvider } from "../rpc.js";

describe("DefaultEvmBalanceReader", () => {
  const address = "0x0000000000000000000000000000000000000001";

  it("reads the native balance using eth_getBalance", async () => {
    const requests: Array<{
      method: string;
      params: readonly unknown[];
    }> = [];

    const provider: EvmRpcProvider = {
      networkId: "ethereum-mainnet",

      async request<TResponse>(method: string, params: readonly unknown[]): Promise<TResponse> {
        requests.push({ method, params });

        return "0x16345785d8a0000" as TResponse;
      },
    };

    const reader = new DefaultEvmBalanceReader(provider);

    const balance = await reader.getNativeBalance(address);

    expect(balance).toBe(100000000000000000n);

    expect(requests).toEqual([
      {
        method: "eth_getBalance",
        params: [address, "latest"],
      },
    ]);
  });

  it("accepts an explicit block tag", async () => {
    const requests: Array<{
      method: string;
      params: readonly unknown[];
    }> = [];

    const provider: EvmRpcProvider = {
      networkId: "ethereum-mainnet",

      async request<TResponse>(method: string, params: readonly unknown[]): Promise<TResponse> {
        requests.push({ method, params });

        return "0x2a" as TResponse;
      },
    };

    const reader = new DefaultEvmBalanceReader(provider);

    const balance = await reader.getNativeBalance(address, "0x123456");

    expect(balance).toBe(42n);

    expect(requests).toEqual([
      {
        method: "eth_getBalance",
        params: [address, "0x123456"],
      },
    ]);
  });

  it("rejects an invalid address before making an RPC request", async () => {
    let requestCount = 0;

    const provider: EvmRpcProvider = {
      networkId: "ethereum-mainnet",

      async request<TResponse>(): Promise<TResponse> {
        requestCount += 1;
        return "0x0" as TResponse;
      },
    };

    const reader = new DefaultEvmBalanceReader(provider);

    await expect(reader.getNativeBalance("not-an-address")).rejects.toThrow("Invalid EVM address");

    expect(requestCount).toBe(0);
  });

  it("rejects an empty block tag", async () => {
    const provider: EvmRpcProvider = {
      networkId: "ethereum-mainnet",

      async request<TResponse>(): Promise<TResponse> {
        return "0x0" as TResponse;
      },
    };

    const reader = new DefaultEvmBalanceReader(provider);

    await expect(reader.getNativeBalance(address, " ")).rejects.toThrow(
      "EVM block tag is required",
    );
  });

  it("rejects an invalid RPC quantity", async () => {
    const provider: EvmRpcProvider = {
      networkId: "ethereum-mainnet",

      async request<TResponse>(): Promise<TResponse> {
        return "not-hex" as TResponse;
      },
    };

    const reader = new DefaultEvmBalanceReader(provider);

    await expect(reader.getNativeBalance(address)).rejects.toThrow("Invalid EVM quantity");
  });
});

describe("parseEvmQuantity", () => {
  it("parses hexadecimal quantities into bigint", () => {
    expect(parseEvmQuantity("0x0")).toBe(0n);
    expect(parseEvmQuantity("0x2a")).toBe(42n);
    expect(parseEvmQuantity("0xffffffffffffffffffffffffffffffffffffffff")).toBe(
      1461501637330902918203684832716283019655932542975n,
    );
  });

  it("accepts uppercase hexadecimal digits", () => {
    expect(parseEvmQuantity("0xABCDEF")).toBe(11259375n);
  });

  it("rejects values without the 0x prefix", () => {
    expect(() => parseEvmQuantity("2a")).toThrow("Invalid EVM quantity");
  });

  it("rejects empty quantities", () => {
    expect(() => parseEvmQuantity("0x")).toThrow("Invalid EVM quantity");
  });

  it("rejects non-hexadecimal values", () => {
    expect(() => parseEvmQuantity("0x12gg")).toThrow("Invalid EVM quantity");
  });
});
