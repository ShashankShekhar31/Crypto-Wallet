import { describe, expect, it } from "vitest";

import { bitcoinAddressFromPublicKey } from "../address.js";

const BIP84_PUBLIC_KEY = Uint8Array.from(
  Buffer.from("0330d54fd0dd420a6e5f8d3624f5f3482cae350f79d5f0753bf5beef9c2d91af3c", "hex"),
);

describe("bitcoinAddressFromPublicKey", () => {
  it("derives the official BIP-84 mainnet address", () => {
    const address = bitcoinAddressFromPublicKey(
      BIP84_PUBLIC_KEY,
      "native-segwit",
      "bitcoin-mainnet",
    );

    expect(address).toBe("bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu");
  });

  it("derives the corresponding testnet SegWit address", () => {
    const address = bitcoinAddressFromPublicKey(
      BIP84_PUBLIC_KEY,
      "native-segwit",
      "bitcoin-testnet",
    );

    expect(address).toBe("tb1qcr8te4kr609gcawutmrza0j4xv80jy8zmfp6l0");
  });

  it("derives a mainnet legacy P2PKH address", () => {
    const address = bitcoinAddressFromPublicKey(BIP84_PUBLIC_KEY, "legacy", "bitcoin-mainnet");

    expect(address).toBe("1JaUQDVNRdhfNsVncGkXedaPSM5Gc54Hso");
  });

  it("derives a testnet legacy P2PKH address", () => {
    const address = bitcoinAddressFromPublicKey(BIP84_PUBLIC_KEY, "legacy", "bitcoin-testnet");

    expect(address).toMatch(/^[mn2-9A-HJ-NP-Za-km-z]+$/);
  });

  it("rejects an uncompressed public key", () => {
    const publicKey = new Uint8Array(65);

    publicKey[0] = 0x04;

    expect(() =>
      bitcoinAddressFromPublicKey(publicKey, "native-segwit", "bitcoin-mainnet"),
    ).toThrow("Bitcoin public key must be 33 bytes");
  });

  it("rejects an invalid compressed public key prefix", () => {
    const publicKey = new Uint8Array(33);

    publicKey[0] = 0x04;

    expect(() =>
      bitcoinAddressFromPublicKey(publicKey, "native-segwit", "bitcoin-mainnet"),
    ).toThrow("Bitcoin public key must be compressed");
  });

  it("does not mutate the public key", () => {
    const publicKey = new Uint8Array(BIP84_PUBLIC_KEY);

    const original = new Uint8Array(publicKey);

    bitcoinAddressFromPublicKey(publicKey, "native-segwit", "bitcoin-mainnet");

    expect(publicKey).toEqual(original);
  });
});
