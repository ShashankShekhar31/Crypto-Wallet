import { describe, expect, it } from "vitest";

import {
  isValidSolanaAddress,
  validateSolanaAddress,
} from "../address.js";

describe("Solana address validation", () => {
  const validAddress =
    "11111111111111111111111111111111";

  it("accepts a valid 32-byte Base58 address", () => {
    expect(validateSolanaAddress(validAddress)).toBe(
      validAddress,
    );
  });

  it("returns true for a valid address", () => {
    expect(isValidSolanaAddress(validAddress)).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    expect(
      validateSolanaAddress(`  ${validAddress}  `),
    ).toBe(validAddress);
  });

  it("rejects an empty address", () => {
    expect(() => validateSolanaAddress("")).toThrow(
      "Solana address is required",
    );
  });

  it("rejects invalid Base58", () => {
    expect(() => validateSolanaAddress("0OIl")).toThrow(
      "Invalid Solana address",
    );
  });

  it("rejects a Base58 value with the wrong decoded length", () => {
    expect(() =>
      validateSolanaAddress("123456789"),
    ).toThrow("Invalid Solana address");
  });

  it("returns false for an invalid address", () => {
    expect(isValidSolanaAddress("invalid")).toBe(false);
  });
});