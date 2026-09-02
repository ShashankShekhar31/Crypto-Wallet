import { describe, expect, it } from "vitest";

import { EsploraBitcoinProvider } from "../esplora-provider.js";

const VALID_ADDRESS = "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu";

describe("EsploraBitcoinProvider", () => {
  it("uses the mainnet endpoint", async () => {
    let requestedUrl = "";

    const provider = new EsploraBitcoinProvider("bitcoin-mainnet", async (url) => {
      requestedUrl = url;

      return {
        ok: true,
        status: 200,
        json: async () => [],
      };
    });

    await provider.getUtxos(VALID_ADDRESS);

    expect(requestedUrl).toBe(
      "https://blockstream.info/api/address/bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu/utxo",
    );
  });

  it("resolves the previous output for each UTXO", async () => {
    const requestedUrls: string[] = [];

    const txid = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    const provider = new EsploraBitcoinProvider("bitcoin-mainnet", async (url) => {
      requestedUrls.push(url);

      if (url.endsWith(`/address/${VALID_ADDRESS}/utxo`)) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              txid,
              vout: 2,
              value: 150000,
              status: {
                confirmed: true,
              },
            },
          ],
        };
      }

      if (url.endsWith(`/tx/${txid}`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            vout: [
              {
                value: 1000,
                scriptpubkey: "0014aabb",
              },
              {
                value: 2000,
                scriptpubkey: "0014ccdd",
              },
              {
                value: 150000,
                scriptpubkey: "0014aabbccddeeff00112233445566778899aabbccdd",
              },
            ],
          }),
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const utxos = await provider.getUtxos(VALID_ADDRESS);

    expect(utxos).toHaveLength(1);

    expect(utxos[0]?.txid).toBe(txid);

    expect(utxos[0]?.vout).toBe(2);

    expect(utxos[0]?.value).toBe(150000n);

    expect(utxos[0]?.scriptPubKey).toEqual(
      Uint8Array.from([
        0x00, 0x14, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66,
        0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd,
      ]),
    );

    expect(utxos[0]?.confirmations).toBe(1);

    expect(requestedUrls).toEqual([
      `https://blockstream.info/api/address/${VALID_ADDRESS}/utxo`,
      `https://blockstream.info/api/tx/${txid}`,
    ]);
  });

  it("marks unconfirmed UTXOs with zero confirmations", async () => {
    const txid = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

    const provider = new EsploraBitcoinProvider("bitcoin-mainnet", async (url) => {
      if (url.endsWith(`/address/${VALID_ADDRESS}/utxo`)) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              txid,
              vout: 0,
              value: 50000,
              status: {
                confirmed: false,
              },
            },
          ],
        };
      }

      if (url.endsWith(`/tx/${txid}`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            vout: [
              {
                value: 50000,
                scriptpubkey: "0014aabbccddeeff00112233445566778899aabbccdd",
              },
            ],
          }),
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const utxos = await provider.getUtxos(VALID_ADDRESS);

    expect(utxos).toHaveLength(1);

    expect(utxos[0]?.confirmations).toBe(0);

    expect(utxos[0]?.value).toBe(50000n);

    expect(utxos[0]?.scriptPubKey).toEqual(
      Uint8Array.from([
        0x00, 0x14, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66,
        0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd,
      ]),
    );
  });

  it("uses the fee-estimates endpoint", async () => {
    let requestedUrl = "";

    const provider = new EsploraBitcoinProvider("bitcoin-mainnet", async (url) => {
      requestedUrl = url;

      return {
        ok: true,
        status: 200,
        json: async () => ({
          "1": 25,
          "3": 15,
          "6": 10,
        }),
      };
    });

    const result = await provider.estimateFee();

    expect(requestedUrl).toBe("https://blockstream.info/api/fee-estimates");

    expect(result.satoshisPerVbyte).toBe(10);
  });

  it("prefers the 3-block estimate when 6-block is unavailable", async () => {
    const provider = new EsploraBitcoinProvider("bitcoin-mainnet", async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        "1": 25,
        "3": 15,
      }),
    }));

    const result = await provider.estimateFee();

    expect(result.satoshisPerVbyte).toBe(15);
  });

  it("prefers the 1-block estimate when other estimates are unavailable", async () => {
    const provider = new EsploraBitcoinProvider("bitcoin-mainnet", async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        "1": 25,
      }),
    }));

    const result = await provider.estimateFee();

    expect(result.satoshisPerVbyte).toBe(25);
  });

  it("rejects an invalid Bitcoin address", async () => {
    const provider = new EsploraBitcoinProvider("bitcoin-mainnet", async () => {
      throw new Error("HTTP should not be called");
    });

    await expect(provider.getUtxos("not-a-bitcoin-address")).rejects.toThrow(
      "Invalid Bitcoin address",
    );
  });

  it("throws on HTTP errors", async () => {
    const provider = new EsploraBitcoinProvider("bitcoin-mainnet", async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    }));

    await expect(provider.getUtxos(VALID_ADDRESS)).rejects.toThrow(
      "Bitcoin Esplora request failed with HTTP 503",
    );
  });

  it("throws when no usable fee estimate exists", async () => {
    const provider = new EsploraBitcoinProvider("bitcoin-mainnet", async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        "6": 0,
        "3": -1,
      }),
    }));

    await expect(provider.estimateFee()).rejects.toThrow("Bitcoin fee estimate is unavailable");
  });

  it("uses the testnet endpoint", async () => {
    let requestedUrl = "";

    const testnetAddress = "tb1qcr8te4kr609gcawutmrza0j4xv80jy8zmfp6l0";

    const provider = new EsploraBitcoinProvider("bitcoin-testnet", async (url) => {
      requestedUrl = url;

      return {
        ok: true,
        status: 200,
        json: async () => [],
      };
    });

    await provider.getUtxos(testnetAddress);

    expect(requestedUrl).toBe(
      "https://blockstream.info/testnet/api/address/tb1qcr8te4kr609gcawutmrza0j4xv80jy8zmfp6l0/utxo",
    );
  });
  it("fails UTXO discovery when the previous output cannot be resolved", async () => {
    const txid = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    const provider = new EsploraBitcoinProvider("bitcoin-mainnet", async (url) => {
      if (url.endsWith(`/address/${VALID_ADDRESS}/utxo`)) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              txid,
              vout: 0,
              value: 100000,
              status: {
                confirmed: true,
              },
            },
          ],
        };
      }

      return {
        ok: false,
        status: 404,
        json: async () => ({}),
      };
    });

    await expect(provider.getUtxos(VALID_ADDRESS)).rejects.toThrow(
      "Bitcoin Esplora request failed with HTTP 404",
    );
  });

  it("broadcasts a raw transaction and returns the transaction id", async () => {
    const rawTransaction = new Uint8Array([0x02, 0x00, 0x00, 0x00]);

    const expectedTxid = "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd";

    const requests: Array<{
      url: string;
      method?: string;
      body?: string;
    }> = [];

    const fetcher = async (
      url: string,
      init?: {
        method?: string;
        body?: string;
      },
    ) => {
      requests.push({
        url,
        method: init?.method,
        body: init?.body,
      });

      return {
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => expectedTxid,
      };
    };

    const provider = new EsploraBitcoinProvider("bitcoin-mainnet", fetcher);

    const txid = await provider.broadcastTransaction(rawTransaction);

    expect(txid).toBe(expectedTxid);

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://blockstream.info/api/tx");
    expect(requests[0]?.method).toBe("POST");
    expect(requests[0]?.body).toBe("02000000");
  });

  it("rejects an empty raw transaction", async () => {
    const fetcher = async () => {
      throw new Error("fetch should not be called");
    };

    const provider = new EsploraBitcoinProvider("bitcoin-mainnet", fetcher);

    await expect(provider.broadcastTransaction(new Uint8Array())).rejects.toThrow(
      "Raw transaction is required",
    );
  });

  it("rejects when Esplora broadcast fails", async () => {
    const fetcher = async () => ({
      ok: false,
      status: 400,
      json: async () => ({}),
      text: async () => "bad transaction",
    });

    const provider = new EsploraBitcoinProvider("bitcoin-mainnet", fetcher);

    await expect(
      provider.broadcastTransaction(new Uint8Array([0x02, 0x00, 0x00, 0x00])),
    ).rejects.toThrow("Bitcoin transaction broadcast failed: 400");
  });

  it("rejects an invalid transaction id response", async () => {
    const fetcher = async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => "not-a-valid-txid",
    });

    const provider = new EsploraBitcoinProvider("bitcoin-mainnet", fetcher);

    await expect(
      provider.broadcastTransaction(new Uint8Array([0x02, 0x00, 0x00, 0x00])),
    ).rejects.toThrow("Invalid Bitcoin transaction ID");
  });

  it("uses the Bitcoin testnet Esplora endpoint", async () => {
    let requestedUrl = "";

    const fetcher = async (
      url: string,
      _init?: {
        method?: string;
        body?: string;
      },
    ) => {
      requestedUrl = url;

      return {
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      };
    };

    const provider = new EsploraBitcoinProvider("bitcoin-testnet", fetcher);

    await provider.broadcastTransaction(new Uint8Array([0x02, 0x00, 0x00, 0x00]));

    expect(requestedUrl).toBe("https://blockstream.info/testnet/api/tx");
  });

  it("returns zero confirmations for an unconfirmed transaction", async () => {
    const txid = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    const requestedUrls: string[] = [];

    const provider = new EsploraBitcoinProvider("bitcoin-mainnet", async (url) => {
      requestedUrls.push(url);

      expect(url).toBe(`https://blockstream.info/api/tx/${txid}/status`);

      return {
        ok: true,
        status: 200,
        json: async () => ({
          confirmed: false,
        }),
      };
    });

    const result = await provider.getTransactionStatus(txid);

    expect(result).toEqual({
      txid,
      confirmed: false,
      confirmations: 0,
    });

    expect(requestedUrls).toHaveLength(1);
  });

  it("returns confirmation details for a confirmed transaction", async () => {
    const txid = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    const blockHash = "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd";

    const requestedUrls: string[] = [];

    const provider = new EsploraBitcoinProvider("bitcoin-mainnet", async (url) => {
      requestedUrls.push(url);

      if (url.endsWith(`/tx/${txid}/status`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            confirmed: true,
            block_height: 900000,
            block_hash: blockHash,
          }),
        };
      }

      if (url.endsWith("/blocks/tip/height")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({}),
          text: async () => "900005",
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await provider.getTransactionStatus(txid);

    expect(result).toEqual({
      txid,
      confirmed: true,
      confirmations: 6,
      blockHeight: 900000,
      blockHash,
    });

    expect(requestedUrls).toEqual([
      `https://blockstream.info/api/tx/${txid}/status`,
      "https://blockstream.info/api/blocks/tip/height",
    ]);
  });

  it("rejects an invalid transaction id", async () => {
    const provider = new EsploraBitcoinProvider("bitcoin-mainnet", async () => {
      throw new Error("HTTP should not be called");
    });

    await expect(provider.getTransactionStatus("invalid-txid")).rejects.toThrow(
      "Invalid Bitcoin transaction ID",
    );
  });

  it("throws when transaction status lookup fails", async () => {
    const txid = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    const provider = new EsploraBitcoinProvider("bitcoin-mainnet", async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    }));

    await expect(provider.getTransactionStatus(txid)).rejects.toThrow(
      "Bitcoin Esplora request failed with HTTP 503",
    );
  });

  it("rejects a confirmed transaction without a valid block height", async () => {
    const txid = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    const provider = new EsploraBitcoinProvider("bitcoin-mainnet", async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        confirmed: true,
        block_height: -1,
        block_hash: "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      }),
    }));

    await expect(provider.getTransactionStatus(txid)).rejects.toThrow(
      "Invalid Bitcoin transaction block height",
    );
  });

  it("rejects a confirmed transaction without a valid block hash", async () => {
    const txid = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    const provider = new EsploraBitcoinProvider("bitcoin-mainnet", async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        confirmed: true,
        block_height: 900000,
        block_hash: "invalid-block-hash",
      }),
    }));

    await expect(provider.getTransactionStatus(txid)).rejects.toThrow(
      "Invalid Bitcoin transaction block hash",
    );
  });

  it("rejects an invalid chain tip height", async () => {
    const txid = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    const blockHash = "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd";

    const provider = new EsploraBitcoinProvider("bitcoin-mainnet", async (url) => {
      if (url.endsWith(`/tx/${txid}/status`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            confirmed: true,
            block_height: 900000,
            block_hash: blockHash,
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => "not-a-height",
      };
    });

    await expect(provider.getTransactionStatus(txid)).rejects.toThrow("Invalid Bitcoin tip height");
  });

  it("rejects when the transaction block is ahead of the chain tip", async () => {
    const txid = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    const blockHash = "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd";

    const provider = new EsploraBitcoinProvider("bitcoin-mainnet", async (url) => {
      if (url.endsWith(`/tx/${txid}/status`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            confirmed: true,
            block_height: 900005,
            block_hash: blockHash,
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => "900004",
      };
    });

    await expect(provider.getTransactionStatus(txid)).rejects.toThrow(
      "Bitcoin transaction block is ahead of chain tip",
    );
  });
});
