import { describe, expect, it } from "vitest";

import { isValidBitcoinAddress, validateBitcoinAddress } from "../address.js";

describe("Bitcoin address validation", () => {
  it("accepts a mainnet legacy address", () => {
    expect(isValidBitcoinAddress("1111111111111111111114oLvT2", "bitcoin-mainnet")).toBe(true);
  });

  it("accepts a mainnet P2SH address", () => {
    expect(isValidBitcoinAddress("31h1vYVSYuKP6AhS86fbRdMw9XHieotbST", "bitcoin-mainnet")).toBe(
      true,
    );
  });

  it("accepts a mainnet SegWit address", () => {
    expect(
      isValidBitcoinAddress("bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu", "bitcoin-mainnet"),
    ).toBe(true);
  });

  it("accepts a testnet legacy address", () => {
    expect(isValidBitcoinAddress("mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn", "bitcoin-testnet")).toBe(
      true,
    );
  });

  it("accepts a testnet P2SH address", () => {
    expect(isValidBitcoinAddress("2N7NaqSKYQUeM8VNgBy8D9xQQbiA8yiJayk", "bitcoin-testnet")).toBe(
      true,
    );
  });

  it("rejects an empty address", () => {
    expect(() => validateBitcoinAddress("   ", "bitcoin-mainnet")).toThrow(
      "Bitcoin address is required",
    );
  });

  it("rejects an invalid address", () => {
    expect(isValidBitcoinAddress("not-a-bitcoin-address", "bitcoin-mainnet")).toBe(false);
  });

  it("rejects a mainnet address on testnet", () => {
    expect(isValidBitcoinAddress("1111111111111111111114oLvT2", "bitcoin-testnet")).toBe(false);
  });

  it("trims a valid address", () => {
    expect(validateBitcoinAddress("  1111111111111111111114oLvT2  ", "bitcoin-mainnet")).toBe(
      "1111111111111111111114oLvT2",
    );
  });

  it("rejects a SegWit address with an invalid checksum", () => {
    expect(
      isValidBitcoinAddress("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt081", "bitcoin-mainnet"),
    ).toBe(false);
  });

  it("rejects a mainnet SegWit address on testnet", () => {
    expect(
      isValidBitcoinAddress("bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu", "bitcoin-testnet"),
    ).toBe(false);
  });

  it("rejects a malformed Bech32 address with a valid prefix", () => {
    expect(isValidBitcoinAddress("bc1thisisnotavalidbitcoinaddress", "bitcoin-mainnet")).toBe(
      false,
    );
  });

  it("rejects a Base58 address with an invalid checksum", () => {
    expect(isValidBitcoinAddress("1111111111111111111114oLvT3", "bitcoin-mainnet")).toBe(false);
  });

  it("accepts a testnet SegWit address", () => {
    expect(
      isValidBitcoinAddress("tb1qcr8te4kr609gcawutmrza0j4xv80jy8zmfp6l0", "bitcoin-testnet"),
    ).toBe(true);
  });
});
