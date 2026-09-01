import { describe, expect, it } from "vitest";

import { DefaultSolanaRpcProvider } from "../provider.js";

import type { SolanaRpcTransport } from "../rpc.js";

import type { SolanaNetworkConfig } from "../types.js";

function createNetwork(
  rpcUrls: readonly string[] = ["https://rpc-one.example", "https://rpc-two.example"],
): SolanaNetworkConfig {
  return Object.freeze({
    id: "solana-testnet",
    name: "Solana Test Network",
    rpcUrls: Object.freeze([...rpcUrls]),
    commitment: "confirmed",
    genesisHash: "test-genesis-hash",
  });
}

function createTransport(
  handler: (
    url: string,
    method: string,
    params: readonly unknown[] | undefined,
  ) => Promise<unknown>,
): SolanaRpcTransport {
  return {
    async request<TResponse>(
      url: string,
      method: string,
      params?: readonly unknown[],
    ): Promise<TResponse> {
      return (await handler(url, method, params)) as TResponse;
    },
  };
}

describe("DefaultSolanaRpcProvider", () => {
  it("selects an endpoint that passes genesis hash validation", async () => {
    const calls: Array<{
      url: string;
      method: string;
      params: readonly unknown[] | undefined;
    }> = [];

    const transport = createTransport(async (url, method, params) => {
      calls.push({
        url,
        method,
        params,
      });

      return "test-genesis-hash";
    });

    const provider = await DefaultSolanaRpcProvider.create(createNetwork(), {
      transport,
    });

    expect(provider.networkId).toBe("solana-testnet");

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      url: "https://rpc-one.example",
      method: "getGenesisHash",
      params: [],
    });
  });

  it("fails over when the first endpoint fails", async () => {
    const calls: string[] = [];

    const transport = createTransport(async (url) => {
      calls.push(url);

      if (url === "https://rpc-one.example") {
        throw new Error("first endpoint failed");
      }

      return "test-genesis-hash";
    });

    const provider = await DefaultSolanaRpcProvider.create(createNetwork(), {
      transport,
    });

    expect(provider.networkId).toBe("solana-testnet");

    expect(calls).toEqual(["https://rpc-one.example", "https://rpc-two.example"]);
  });

  it("fails over when the first endpoint has the wrong genesis hash", async () => {
    const calls: string[] = [];

    const transport = createTransport(async (url) => {
      calls.push(url);

      if (url === "https://rpc-one.example") {
        return "wrong-genesis-hash";
      }

      return "test-genesis-hash";
    });

    const provider = await DefaultSolanaRpcProvider.create(createNetwork(), {
      transport,
    });

    expect(provider.networkId).toBe("solana-testnet");

    expect(calls).toEqual(["https://rpc-one.example", "https://rpc-two.example"]);
  });

  it("rejects an invalid genesis hash response", async () => {
    const transport = createTransport(async () => "");

    await expect(
      DefaultSolanaRpcProvider.create(createNetwork(["https://rpc.example"]), {
        transport,
      }),
    ).rejects.toThrow("No Solana RPC endpoint passed network identity validation");
  });

  it("rejects when all endpoints fail identity validation", async () => {
    const calls: string[] = [];

    const transport = createTransport(async (url) => {
      calls.push(url);

      return "wrong-genesis-hash";
    });

    await expect(
      DefaultSolanaRpcProvider.create(createNetwork(), {
        transport,
      }),
    ).rejects.toThrow("No Solana RPC endpoint passed network identity validation");

    expect(calls).toEqual(["https://rpc-one.example", "https://rpc-two.example"]);
  });

  it("rejects an empty RPC method", async () => {
    const transport = createTransport(async () => "test-genesis-hash");

    const provider = await DefaultSolanaRpcProvider.create(createNetwork(["https://rpc.example"]), {
      transport,
    });

    await expect(provider.request("   ")).rejects.toThrow("Solana RPC method is required");
  });

  it("forwards RPC requests to the validated endpoint", async () => {
    const calls: Array<{
      url: string;
      method: string;
      params: readonly unknown[] | undefined;
    }> = [];

    const transport = createTransport(async (url, method, params) => {
      calls.push({
        url,
        method,
        params,
      });

      if (method === "getGenesisHash") {
        return "test-genesis-hash";
      }

      return {
        value: 123,
      };
    });

    const provider = await DefaultSolanaRpcProvider.create(createNetwork(["https://rpc.example"]), {
      transport,
    });

    const result = await provider.request<{
      value: number;
    }>("getBalance", ["address"]);

    expect(result).toEqual({
      value: 123,
    });

    expect(calls[1]).toEqual({
      url: "https://rpc.example",
      method: "getBalance",
      params: ["address"],
    });
  });
});
