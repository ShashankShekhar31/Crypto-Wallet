import { describe, expect, it } from "vitest";

import { bitcoinAddressToScriptPubKey } from "../address.js";

describe("Bitcoin address scriptPubKey conversion", () => {
  it("converts a P2PKH mainnet address", () => {
    const script = bitcoinAddressToScriptPubKey("1111111111111111111114oLvT2", "bitcoin-mainnet");

    expect(Array.from(script)).toEqual([0x76, 0xa9, 0x14, ...new Array(20).fill(0), 0x88, 0xac]);
  });

  it("converts a P2SH mainnet address", () => {
    const script = bitcoinAddressToScriptPubKey(
      "31h1vYVSYuKP6AhS86fbRdMw9XHieotbST",
      "bitcoin-mainnet",
    );

    expect(script[0]).toBe(0xa9);
    expect(script[1]).toBe(0x14);
    expect(script.length).toBe(23);
    expect(script[22]).toBe(0x87);
  });

  it("converts a native SegWit address", () => {
    const script = bitcoinAddressToScriptPubKey(
      "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu",
      "bitcoin-mainnet",
    );

    expect(script[0]).toBe(0x00);
    expect(script[1]).toBe(0x14);
    expect(script.length).toBe(22);
  });
});
