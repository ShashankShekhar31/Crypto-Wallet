import { describe, expect, it } from "vitest";

import { EsploraBitcoinProvider } from "../esplora-provider.js";

const TXID = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("EsploraBitcoinProvider transaction outputs", () => {
  it("retrieves a transaction output", async () => {
    let requestedUrl = "";

    const provider = new EsploraBitcoinProvider("bitcoin-mainnet", async (url) => {
      requestedUrl = url;

      return {
        ok: true,
        status: 200,
        json: async () => ({
          vout: [
            {
              value: 100000,
              scriptpubkey: "0014aabbccddeeff00112233445566778899aabbccdd",
            },
          ],
        }),
      };
    });

    const output = await provider.getTransactionOutput(TXID, 0);

    expect(requestedUrl).toBe(`https://blockstream.info/api/tx/${TXID}`);

    expect(output.value).toBe(100000n);

    expect(output.scriptPubKey).toEqual(
      Uint8Array.from([
        0x00, 0x14, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66,
        0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd,
      ]),
    );
  });

  it("supports a non-zero output index", async () => {
    const provider = new EsploraBitcoinProvider("bitcoin-mainnet", async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        vout: [
          {
            value: 1000,
            scriptpubkey: "0014aabb",
          },
          {
            value: 2500,
            scriptpubkey: "0014ccdd",
          },
        ],
      }),
    }));

    const output = await provider.getTransactionOutput(TXID, 1);

    expect(output.value).toBe(2500n);

    expect(output.scriptPubKey).toEqual(Uint8Array.from([0x00, 0x14, 0xcc, 0xdd]));
  });

  it("rejects an invalid transaction id", async () => {
    const provider = new EsploraBitcoinProvider("bitcoin-mainnet", async () => {
      throw new Error("HTTP should not be called");
    });

    await expect(provider.getTransactionOutput("invalid", 0)).rejects.toThrow(
      "Invalid Bitcoin transaction id",
    );
  });

  it("rejects a negative output index", async () => {
    const provider = new EsploraBitcoinProvider("bitcoin-mainnet", async () => {
      throw new Error("HTTP should not be called");
    });

    await expect(provider.getTransactionOutput(TXID, -1)).rejects.toThrow(
      "Bitcoin transaction output index must be a non-negative integer",
    );
  });

  it("rejects a missing output", async () => {
    const provider = new EsploraBitcoinProvider("bitcoin-mainnet", async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        vout: [],
      }),
    }));

    await expect(provider.getTransactionOutput(TXID, 0)).rejects.toThrow(
      "Bitcoin transaction output 0 does not exist",
    );
  });

  it("rejects malformed scriptPubKey hex", async () => {
    const provider = new EsploraBitcoinProvider("bitcoin-mainnet", async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        vout: [
          {
            value: 1000,
            scriptpubkey: "xyz",
          },
        ],
      }),
    }));

    await expect(provider.getTransactionOutput(TXID, 0)).rejects.toThrow(
      "Invalid Bitcoin scriptPubKey hex",
    );
  });

  it("rejects a negative output value", async () => {
    const provider = new EsploraBitcoinProvider("bitcoin-mainnet", async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        vout: [
          {
            value: -1,
            scriptpubkey: "0014aabb",
          },
        ],
      }),
    }));

    await expect(provider.getTransactionOutput(TXID, 0)).rejects.toThrow(
      "Invalid Bitcoin transaction output value",
    );
  });

  it("throws on HTTP errors", async () => {
    const provider = new EsploraBitcoinProvider("bitcoin-mainnet", async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    }));

    await expect(provider.getTransactionOutput(TXID, 0)).rejects.toThrow(
      "Bitcoin Esplora request failed with HTTP 404",
    );
  });
});
