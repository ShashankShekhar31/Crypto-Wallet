import {
  describe,
  expect,
  it,
} from "vitest";

import {
  SolanaJsonRpcHttpTransport,
} from "../http-transport.js";

import type {
  SolanaFetch,
  SolanaFetchResponse,
} from "../http-transport.js";

function createResponse(
  payload: unknown,
  options: {
    ok?: boolean;
    status?: number;
  } = {},
): SolanaFetchResponse {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    json: async () => payload,
  };
}

describe("SolanaJsonRpcHttpTransport", () => {
  it("sends a JSON-RPC POST request", async () => {
    let receivedUrl = "";
    let receivedMethod = "";
    let receivedHeaders: Record<string, string> | undefined;
    let receivedBody = "";

    const fetch: SolanaFetch = async (
      url,
      init,
    ) => {
      receivedUrl = url;
      receivedMethod = init?.method ?? "";
      receivedHeaders = init?.headers;
      receivedBody = init?.body ?? "";

      return createResponse({
        jsonrpc: "2.0",
        id: 1,
        result: "test-genesis-hash",
      });
    };

    const transport =
      new SolanaJsonRpcHttpTransport({
        fetch,
      });

    const result =
      await transport.request<string>(
        "https://api.devnet.solana.com",
        "getGenesisHash",
      );

    expect(result).toBe("test-genesis-hash");

    expect(receivedUrl).toBe(
      "https://api.devnet.solana.com",
    );

    expect(receivedMethod).toBe("POST");

    expect(receivedHeaders).toEqual({
      "content-type": "application/json",
    });

    expect(JSON.parse(receivedBody)).toEqual({
      jsonrpc: "2.0",
      id: 1,
      method: "getGenesisHash",
      params: [],
    });
  });

  it("forwards RPC parameters", async () => {
    let receivedBody = "";

    const fetch: SolanaFetch = async (
      _url,
      init,
    ) => {
      receivedBody = init?.body ?? "";

      return createResponse({
        jsonrpc: "2.0",
        id: 1,
        result: {
          value: 123,
        },
      });
    };

    const transport =
      new SolanaJsonRpcHttpTransport({
        fetch,
      });

    const result =
      await transport.request<{ value: number }>(
        "https://rpc.example",
        "getBalance",
        ["address", { commitment: "confirmed" }],
      );

    expect(result).toEqual({
      value: 123,
    });

    expect(JSON.parse(receivedBody)).toEqual({
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [
        "address",
        {
          commitment: "confirmed",
        },
      ],
    });
  });

  it("increments JSON-RPC request ids", async () => {
    const ids: number[] = [];

    const fetch: SolanaFetch = async (
      _url,
      init,
    ) => {
      const body = JSON.parse(
        init?.body ?? "{}",
      ) as {
        id: number;
      };

      ids.push(body.id);

      return createResponse({
        jsonrpc: "2.0",
        id: body.id,
        result: "ok",
      });
    };

    const transport =
      new SolanaJsonRpcHttpTransport({
        fetch,
      });

    await transport.request(
      "https://rpc.example",
      "getVersion",
    );

    await transport.request(
      "https://rpc.example",
      "getGenesisHash",
    );

    await transport.request(
      "https://rpc.example",
      "getHealth",
    );

    expect(ids).toEqual([1, 2, 3]);
  });

  it("trims the RPC URL and method", async () => {
    let receivedUrl = "";
    let receivedBody = "";

    const fetch: SolanaFetch = async (
      url,
      init,
    ) => {
      receivedUrl = url;
      receivedBody = init?.body ?? "";

      return createResponse({
        jsonrpc: "2.0",
        id: 1,
        result: "ok",
      });
    };

    const transport =
      new SolanaJsonRpcHttpTransport({
        fetch,
      });

    await transport.request(
      "  https://rpc.example  ",
      "  getHealth  ",
    );

    expect(receivedUrl).toBe(
      "https://rpc.example",
    );

    expect(
      JSON.parse(receivedBody).method,
    ).toBe("getHealth");
  });

  it("rejects an empty RPC URL", async () => {
    const transport =
      new SolanaJsonRpcHttpTransport({
        fetch: async () =>
          createResponse({
            jsonrpc: "2.0",
            id: 1,
            result: "ok",
          }),
      });

    await expect(
      transport.request(
        "   ",
        "getHealth",
      ),
    ).rejects.toThrow(
      "Solana RPC URL is required",
    );
  });

  it("rejects an empty RPC method", async () => {
    const transport =
      new SolanaJsonRpcHttpTransport({
        fetch: async () =>
          createResponse({
            jsonrpc: "2.0",
            id: 1,
            result: "ok",
          }),
      });

    await expect(
      transport.request(
        "https://rpc.example",
        "   ",
      ),
    ).rejects.toThrow(
      "Solana RPC method is required",
    );
  });

  it("rejects network failures", async () => {
    const transport =
      new SolanaJsonRpcHttpTransport({
        fetch: async () => {
          throw new Error("connection refused");
        },
      });

    await expect(
      transport.request(
        "https://rpc.example",
        "getHealth",
      ),
    ).rejects.toThrow(
      "Solana RPC request failed",
    );
  });

  it("rejects non-success HTTP responses", async () => {
    const transport =
      new SolanaJsonRpcHttpTransport({
        fetch: async () =>
          createResponse(
            {
              error: "server failure",
            },
            {
              ok: false,
              status: 503,
            },
          ),
      });

    await expect(
      transport.request(
        "https://rpc.example",
        "getHealth",
      ),
    ).rejects.toThrow(
      "Solana RPC HTTP request failed with status 503",
    );
  });

  it("rejects invalid JSON responses", async () => {
    const transport =
      new SolanaJsonRpcHttpTransport({
        fetch: async () => ({
          ok: true,
          status: 200,
          json: async () => {
            throw new Error("invalid json");
          },
        }),
      });

    await expect(
      transport.request(
        "https://rpc.example",
        "getHealth",
      ),
    ).rejects.toThrow(
      "Invalid Solana RPC JSON response",
    );
  });

  it("rejects responses with an invalid JSON-RPC version", async () => {
    const transport =
      new SolanaJsonRpcHttpTransport({
        fetch: async () =>
          createResponse({
            jsonrpc: "1.0",
            id: 1,
            result: "ok",
          }),
      });

    await expect(
      transport.request(
        "https://rpc.example",
        "getHealth",
      ),
    ).rejects.toThrow(
      "Invalid Solana RPC response",
    );
  });

  it("rejects JSON-RPC errors", async () => {
    const transport =
      new SolanaJsonRpcHttpTransport({
        fetch: async () =>
          createResponse({
            jsonrpc: "2.0",
            id: 1,
            error: {
              code: -32601,
              message: "Method not found",
            },
          }),
      });

    await expect(
      transport.request(
        "https://rpc.example",
        "unknownMethod",
      ),
    ).rejects.toThrow(
      "Solana RPC error -32601: Method not found",
    );
  });

  it("rejects a response without a result", async () => {
    const transport =
      new SolanaJsonRpcHttpTransport({
        fetch: async () =>
          createResponse({
            jsonrpc: "2.0",
            id: 1,
          }),
      });

    await expect(
      transport.request(
        "https://rpc.example",
        "getHealth",
      ),
    ).rejects.toThrow(
      "Solana RPC response has no result",
    );
  });

  it("returns structured RPC results", async () => {
    const transport =
      new SolanaJsonRpcHttpTransport({
        fetch: async () =>
          createResponse({
            jsonrpc: "2.0",
            id: 1,
            result: {
              value: 123,
              context: {
                slot: 456,
              },
            },
          }),
      });

    const result =
      await transport.request<{
        value: number;
        context: {
          slot: number;
        };
      }>(
        "https://rpc.example",
        "getBalance",
        ["address"],
      );

    expect(result).toEqual({
      value: 123,
      context: {
        slot: 456,
      },
    });
  });
});