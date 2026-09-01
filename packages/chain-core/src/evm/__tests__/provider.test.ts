import { describe, expect, it } from "vitest";

import { DefaultEvmRpcProvider } from "../provider.js";

import type { EvmRpcTransport } from "../rpc.js";

describe("DefaultEvmRpcProvider", () => {
  const network = {
    id: "ethereum-mainnet",
    name: "Ethereum Mainnet",
    chainId: 1n,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: ["https://rpc.example.com", "https://backup.example.com"],
  };

  it("creates a provider when the first RPC reports the expected chain", async () => {
    const requests: Array<{
      url: string;
      method: string;
      params: readonly unknown[];
    }> = [];

    const transport: EvmRpcTransport = {
      async request<TResponse>(
        url: string,
        method: string,
        params: readonly unknown[],
      ): Promise<TResponse> {
        requests.push({ url, method, params });

        return "0x1" as TResponse;
      },
    };

    const provider = await DefaultEvmRpcProvider.create(network, { transport });

    expect(provider.networkId).toBe("ethereum-mainnet");

    expect(requests).toEqual([
      {
        url: "https://rpc.example.com",
        method: "eth_chainId",
        params: [],
      },
    ]);
  });

  it("does not try the second RPC when the first succeeds", async () => {
    const requests: string[] = [];

    const transport: EvmRpcTransport = {
      async request<TResponse>(url: string, _method: string): Promise<TResponse> {
        requests.push(url);

        return "0x1" as TResponse;
      },
    };

    await DefaultEvmRpcProvider.create(network, { transport });

    expect(requests).toEqual(["https://rpc.example.com"]);
  });

  it("fails over when the first RPC has a transport failure", async () => {
    const requests: string[] = [];

    const transport: EvmRpcTransport = {
      async request<TResponse>(url: string): Promise<TResponse> {
        requests.push(url);

        if (url === "https://rpc.example.com") {
          throw new Error("primary RPC unavailable");
        }

        return "0x1" as TResponse;
      },
    };

    const provider = await DefaultEvmRpcProvider.create(network, { transport });

    expect(provider.networkId).toBe("ethereum-mainnet");

    expect(requests).toEqual(["https://rpc.example.com", "https://backup.example.com"]);
  });

  it("fails over when the first RPC reports the wrong chain", async () => {
    const requests: string[] = [];

    const transport: EvmRpcTransport = {
      async request<TResponse>(url: string): Promise<TResponse> {
        requests.push(url);

        if (url === "https://rpc.example.com") {
          return "0x89" as TResponse;
        }

        return "0x1" as TResponse;
      },
    };

    const provider = await DefaultEvmRpcProvider.create(network, { transport });

    expect(provider.networkId).toBe("ethereum-mainnet");

    expect(requests).toEqual(["https://rpc.example.com", "https://backup.example.com"]);
  });

  it("rejects when all RPC endpoints fail", async () => {
    const requests: string[] = [];

    const transport: EvmRpcTransport = {
      async request<TResponse>(url: string): Promise<TResponse> {
        requests.push(url);

        throw new Error(`RPC unavailable: ${url}`);
      },
    };

    await expect(DefaultEvmRpcProvider.create(network, { transport })).rejects.toThrow(
      "No EVM RPC endpoint passed chain identity validation",
    );

    expect(requests).toEqual(["https://rpc.example.com", "https://backup.example.com"]);
  });

  it("uses the selected fallback RPC for subsequent requests", async () => {
    const requests: Array<{
      url: string;
      method: string;
      params: readonly unknown[];
    }> = [];

    const transport: EvmRpcTransport = {
      async request<TResponse>(
        url: string,
        method: string,
        params: readonly unknown[],
      ): Promise<TResponse> {
        requests.push({ url, method, params });

        if (url === "https://rpc.example.com") {
          throw new Error("primary RPC unavailable");
        }

        if (method === "eth_chainId") {
          return "0x1" as TResponse;
        }

        return "0x123" as TResponse;
      },
    };

    const provider = await DefaultEvmRpcProvider.create(network, { transport });

    const result = await provider.request<string>("eth_blockNumber", []);

    expect(result).toBe("0x123");

    expect(requests).toEqual([
      {
        url: "https://rpc.example.com",
        method: "eth_chainId",
        params: [],
      },
      {
        url: "https://backup.example.com",
        method: "eth_chainId",
        params: [],
      },
      {
        url: "https://backup.example.com",
        method: "eth_blockNumber",
        params: [],
      },
    ]);
  });

  it("rejects a malformed RPC chain ID", async () => {
    const transport: EvmRpcTransport = {
      async request<TResponse>(): Promise<TResponse> {
        return "ethereum" as TResponse;
      },
    };

    await expect(DefaultEvmRpcProvider.create(network, { transport })).rejects.toThrow(
      "No EVM RPC endpoint passed chain identity validation",
    );
  });

  it("rejects an empty RPC method after provider creation", async () => {
    const transport: EvmRpcTransport = {
      async request<TResponse>(): Promise<TResponse> {
        return "0x1" as TResponse;
      },
    };

    const provider = await DefaultEvmRpcProvider.create(network, { transport });

    await expect(provider.request(" ")).rejects.toThrow("EVM RPC method is required");
  });
});
