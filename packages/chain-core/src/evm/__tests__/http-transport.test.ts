import { describe, expect, it } from "vitest";

import {
  EvmJsonRpcHttpTransport,
  type EvmFetch,
} from "../http-transport.js";

describe("EvmJsonRpcHttpTransport", () => {
    const rpcUrl = "https://rpc.example.com";
  it("sends a valid JSON-RPC POST request", async () => {
    let receivedInput = "";
    let receivedInit:
      | {
          readonly method?: string;
          readonly headers?: Record<string, string>;
          readonly body?: string;
        }
      | undefined;

    const fetch: EvmFetch = async (input, init) => {
      receivedInput = input;
      receivedInit = init;

      return {
        ok: true,
        status: 200,
        async json() {
          return {
            jsonrpc: "2.0",
            id: 1,
            result: "0x1",
          };
        },
      };
    };

    const transport = new EvmJsonRpcHttpTransport({ fetch });

    const result = await transport.request<string>(
        rpcUrl,
      "eth_chainId",
      [],
    );

    expect(result).toBe("0x1");
    expect(receivedInput).toBe("https://rpc.example.com");

    expect(receivedInit).toEqual({
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_chainId",
        params: [],
      }),
    });
  });

  it("sends RPC parameters correctly", async () => {
    let receivedBody = "";

    const fetch: EvmFetch = async (_input, init) => {
      receivedBody = init?.body ?? "";

      return {
        ok: true,
        status: 200,
        async json() {
          return {
            jsonrpc: "2.0",
            id: 1,
            result: "0x123",
          };
        },
      };
    };

    const transport = new EvmJsonRpcHttpTransport({ fetch });

    await transport.request<string>(
        rpcUrl,
        "eth_getBalance",
        ["0xabc", "latest"],
    );

    expect(JSON.parse(receivedBody)).toEqual({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBalance",
      params: ["0xabc", "latest"],
    });
  });

  it("rejects an HTTP failure", async () => {
    const fetch: EvmFetch = async () => ({
      ok: false,
      status: 503,
      async json() {
        return {};
      },
    });

    const transport = new EvmJsonRpcHttpTransport({ fetch });

    await expect(
      transport.request(rpcUrl, "eth_chainId", []),
    ).rejects.toThrow(
      "EVM RPC HTTP request failed with status 503",
    );
  });

  it("rejects a malformed JSON-RPC response", async () => {
    const fetch: EvmFetch = async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          unexpected: true,
        };
      },
    });

    const transport = new EvmJsonRpcHttpTransport({ fetch });

    await expect(
      transport.request(rpcUrl, "eth_chainId", []),
    ).rejects.toThrow("Invalid EVM JSON-RPC response");
  });

  it("rejects an invalid JSON-RPC version", async () => {
    const fetch: EvmFetch = async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          jsonrpc: "1.0",
          id: 1,
          result: "0x1",
        };
      },
    });

    const transport = new EvmJsonRpcHttpTransport({ fetch });

    await expect(
      transport.request(rpcUrl, "eth_chainId", []),
    ).rejects.toThrow("Invalid EVM JSON-RPC response");
  });

  it("rejects an invalid JSON-RPC id", async () => {
    const fetch: EvmFetch = async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          jsonrpc: "2.0",
          id: "1",
          result: "0x1",
        };
      },
    });

    const transport = new EvmJsonRpcHttpTransport({ fetch });

    await expect(
      transport.request(rpcUrl, "eth_chainId", []),
    ).rejects.toThrow("Invalid EVM JSON-RPC response");
  });

  it("rejects a JSON-RPC error response", async () => {
    const fetch: EvmFetch = async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          error: {
            code: -32000,
            message: "execution reverted",
          },
        };
      },
    });

    const transport = new EvmJsonRpcHttpTransport({ fetch });

    await expect(
      transport.request(rpcUrl, "eth_call", []),
    ).rejects.toThrow(
      "EVM RPC error -32000: execution reverted",
    );
  });

  it("accepts a valid JSON-RPC error envelope before rejecting it", async () => {
    const fetch: EvmFetch = async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          error: {
            code: -32601,
            message: "Method not found",
          },
        };
      },
    });

    const transport = new EvmJsonRpcHttpTransport({ fetch });

    await expect(
      transport.request(rpcUrl, "eth_unknownMethod", []),
    ).rejects.toThrow(
      "EVM RPC error -32601: Method not found",
    );
  });

  it("propagates fetch failures", async () => {
    const fetchError = new Error("network failure");

    const fetch: EvmFetch = async () => {
      throw fetchError;
    };

    const transport = new EvmJsonRpcHttpTransport({ fetch });

    await expect(
      transport.request(rpcUrl, "eth_chainId", []),
    ).rejects.toBe(fetchError);
  });
});