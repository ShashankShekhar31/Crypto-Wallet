import { describe, expect, it } from "vitest";

import { isValidBitcoinBlockhash, validateBitcoinBlockhash } from "../blockhash.js";

const BLOCKHASH = "0000000000000000000123456789abcdef0123456789abcdef0123456789abcd";

describe("Bitcoin blockhash validation", () => {
  it("accepts a valid blockhash", () => {
    expect(isValidBitcoinBlockhash(BLOCKHASH)).toBe(true);
  });

  it("accepts uppercase hexadecimal", () => {
    expect(isValidBitcoinBlockhash(BLOCKHASH.toUpperCase())).toBe(true);
  });

  it("accepts mixed-case hexadecimal", () => {
    expect(
      isValidBitcoinBlockhash("0000000000000000000123456789ABCdef0123456789abcdef0123456789ABcd"),
    ).toBe(true);
  });

  it("trims a valid blockhash", () => {
    expect(validateBitcoinBlockhash(`  ${BLOCKHASH}  `)).toBe(BLOCKHASH);
  });

  it("rejects an empty blockhash", () => {
    expect(() => validateBitcoinBlockhash("   ")).toThrow("Bitcoin blockhash is required");
  });

  it("rejects a short blockhash", () => {
    expect(isValidBitcoinBlockhash(BLOCKHASH.slice(0, 63))).toBe(false);
  });

  it("rejects a long blockhash", () => {
    expect(isValidBitcoinBlockhash(`${BLOCKHASH}0`)).toBe(false);
  });

  it("rejects non-hexadecimal characters", () => {
    const invalid = `${BLOCKHASH.slice(0, 63)}g`;

    expect(isValidBitcoinBlockhash(invalid)).toBe(false);
  });

  it("rejects an invalid blockhash", () => {
    expect(() => validateBitcoinBlockhash("not-a-bitcoin-blockhash")).toThrow(
      "Invalid Bitcoin blockhash",
    );
  });
});
