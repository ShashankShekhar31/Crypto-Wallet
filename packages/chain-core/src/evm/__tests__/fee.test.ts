import { describe, expect, it } from "vitest";

import { estimateEvmTransactionFees } from "../fee.js";

import type { EvmRpcProvider } from "../rpc.js";

describe("estimateEvmTransactionFees", () => {
  const transaction = {
    to: "0x0000000000000000000000000000000000000002",
    value: 100n,
    data: "0x",
    nonce: 1n,
    gasLimit: 21000n,
    maxFeePerGas: 30n,
    maxPriorityFeePerGas: 2n,
  };

  it("estimates gas and EIP-1559 fee values", async () => {
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

        const responses: Record<string, string> = {
          eth_estimateGas: "0x5208",
          eth_gasPrice: "0x3b9aca00",
          eth_maxPriorityFeePerGas: "0x7735940",
        };

        return responses[method] as TResponse;
      },
    };

    const estimate = await estimateEvmTransactionFees(provider, transaction);

    expect(estimate).toEqual({
      gasLimit: 21000n,
      gasPrice: 1_000_000_000n,
      maxPriorityFeePerGas: 125_000_000n,
      maxFeePerGas: 1_000_000_000n,
    });

    expect(requests).toEqual([
      {
        method: "eth_estimateGas",
        params: [
          {
            to: transaction.to,
            value: "0x64",
            data: "0x",
          },
        ],
      },
      {
        method: "eth_gasPrice",
        params: [],
      },
      {
        method: "eth_maxPriorityFeePerGas",
        params: [],
      },
    ]);
  });

  it("accepts a zero transaction value", async () => {
    const provider: EvmRpcProvider = {
      networkId: "ethereum-mainnet",

      async request<TResponse>(method: string): Promise<TResponse> {
        const responses: Record<string, string> = {
          eth_estimateGas: "0x5208",
          eth_gasPrice: "0x64",
          eth_maxPriorityFeePerGas: "0x2",
        };

        return responses[method] as TResponse;
      },
    };

    const estimate = await estimateEvmTransactionFees(provider, {
      ...transaction,
      value: 0n,
    });

    expect(estimate.gasLimit).toBe(21000n);
    expect(estimate.maxFeePerGas).toBe(100n);
  });

  it("passes transaction data to eth_estimateGas", async () => {
    let receivedParams: readonly unknown[] | undefined;

    const provider: EvmRpcProvider = {
      networkId: "ethereum-mainnet",

      async request<TResponse>(method: string, params: readonly unknown[]): Promise<TResponse> {
        if (method === "eth_estimateGas") {
          receivedParams = params;
        }

        const responses: Record<string, string> = {
          eth_estimateGas: "0x10000",
          eth_gasPrice: "0x64",
          eth_maxPriorityFeePerGas: "0x2",
        };

        return responses[method] as TResponse;
      },
    };

    await estimateEvmTransactionFees(provider, {
      ...transaction,
      data: "0xabcdef",
    });

    expect(receivedParams).toEqual([
      {
        to: transaction.to,
        value: "0x64",
        data: "0xabcdef",
      },
    ]);
  });

  it("rejects an invalid gas estimate", async () => {
    const provider: EvmRpcProvider = {
      networkId: "ethereum-mainnet",

      async request<TResponse>(): Promise<TResponse> {
        return "0x0" as TResponse;
      },
    };

    await expect(estimateEvmTransactionFees(provider, transaction)).rejects.toThrow(
      "EVM gas estimate must be greater than zero",
    );
  });

  it("rejects an invalid gas price", async () => {
    const provider: EvmRpcProvider = {
      networkId: "ethereum-mainnet",

      async request<TResponse>(method: string): Promise<TResponse> {
        if (method === "eth_estimateGas") {
          return "0x5208" as TResponse;
        }

        if (method === "eth_gasPrice") {
          return "0x0" as TResponse;
        }

        return "0x2" as TResponse;
      },
    };

    await expect(estimateEvmTransactionFees(provider, transaction)).rejects.toThrow(
      "EVM gas price must be greater than zero",
    );
  });

  it("rejects a priority fee greater than the gas price", async () => {
    const provider: EvmRpcProvider = {
      networkId: "ethereum-mainnet",

      async request<TResponse>(method: string): Promise<TResponse> {
        if (method === "eth_estimateGas") {
          return "0x5208" as TResponse;
        }

        if (method === "eth_gasPrice") {
          return "0x64" as TResponse;
        }

        return "0x65" as TResponse;
      },
    };

    await expect(estimateEvmTransactionFees(provider, transaction)).rejects.toThrow(
      "EVM priority fee cannot exceed gas price",
    );
  });

  it("propagates RPC errors", async () => {
    const rpcError = new Error("RPC unavailable");

    const provider: EvmRpcProvider = {
      networkId: "ethereum-mainnet",

      async request<TResponse>(): Promise<TResponse> {
        throw rpcError;
      },
    };

    await expect(estimateEvmTransactionFees(provider, transaction)).rejects.toBe(rpcError);
  });
});
