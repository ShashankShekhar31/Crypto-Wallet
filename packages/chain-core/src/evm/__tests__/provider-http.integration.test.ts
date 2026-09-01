import { describe, expect, it } from "vitest";

import {
  EvmJsonRpcHttpTransport,
  type EvmFetch,
} from "../http-transport.js";

import {
  DefaultEvmRpcProvider,
} from "../provider.js";

describe("EVM provider HTTP integration", () => {
  const network = {
    id: "local-ethereum",
    name: "Local Ethereum",
    chainId: 31337n,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: [
      "http://127.0.0.1:8545",
    ],
  };

  it("accepts a local RPC node reporting the expected chain", async () => {
    const requests: Array<{
      url: string;
      method: string;
      body: string;
    }> = [];

    const fetch: EvmFetch = async (
      input,
      init,
    ) => {
      requests.push({
        url: input,
        method: init?.method ?? "",
        body: init?.body ?? "",
      });

      return {
        ok: true,
        status: 200,

        async json() {
          return {
            jsonrpc: "2.0",
            id: 1,
            result: "0x7a69",
          };
        },
      };
    };

    const transport =
      new EvmJsonRpcHttpTransport({
        fetch,
      });

    const provider =
      await DefaultEvmRpcProvider.create(
        network,
        { transport },
      );

    expect(provider.networkId)
      .toBe("local-ethereum");

    expect(requests).toHaveLength(1);

    expect(requests[0]?.url)
      .toBe("http://127.0.0.1:8545");

    expect(JSON.parse(requests[0]?.body ?? ""))
      .toEqual({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_chainId",
        params: [],
      });
  });

  it("rejects a local node reporting the wrong chain", async () => {
    const fetch: EvmFetch = async () => ({
      ok: true,
      status: 200,

      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: "0x1",
        };
      },
    });

    const transport =
      new EvmJsonRpcHttpTransport({
        fetch,
      });

    await expect(
      DefaultEvmRpcProvider.create(
        network,
        { transport },
      ),
    ).rejects.toThrow(
      "No EVM RPC endpoint passed chain identity validation",
    );
  });
});