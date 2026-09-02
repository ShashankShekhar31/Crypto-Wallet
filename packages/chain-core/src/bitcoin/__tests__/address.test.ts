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
      isValidBitcoinAddress("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080", "bitcoin-mainnet"),
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
});
