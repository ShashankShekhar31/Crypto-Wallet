import { describe, expect, it } from "vitest";

import { isValidEvmAddress, validateEvmAddress } from "../address.js";

describe("EVM address validation", () => {
  it("accepts a valid lowercase EVM address", () => {
    const address = "0x0000000000000000000000000000000000000001";

    expect(isValidEvmAddress(address)).toBe(true);
    expect(validateEvmAddress(address)).toBe(address);
  });

  it("accepts a valid uppercase hexadecimal EVM address", () => {
    const address = "0xABCDEFABCDEFABCDEFABCDEFABCDEFABCDEFABCD";

    expect(isValidEvmAddress(address)).toBe(true);
    expect(validateEvmAddress(address)).toBe(address);
  });

  it("accepts a mixed-case EVM address", () => {
    const address = "0xAbCdEf0123456789aBcDeF0123456789aBcDeF01";

    expect(isValidEvmAddress(address)).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    const address = "  0x0000000000000000000000000000000000000001  ";

    expect(validateEvmAddress(address)).toBe("0x0000000000000000000000000000000000000001");
  });

  it("rejects an address without 0x prefix", () => {
    expect(isValidEvmAddress("0000000000000000000000000000000000000001")).toBe(false);
  });

  it("rejects an address that is too short", () => {
    expect(isValidEvmAddress("0x00000000000000000000000000000000000001")).toBe(false);
  });

  it("rejects an address that is too long", () => {
    expect(isValidEvmAddress("0x00000000000000000000000000000000000000001")).toBe(false);
  });

  it("rejects non-hexadecimal characters", () => {
    expect(isValidEvmAddress("0x00000000000000000000000000000000000000gg")).toBe(false);
  });

  it("rejects an empty address", () => {
    expect(isValidEvmAddress("")).toBe(false);
  });

  it("validateEvmAddress throws for an invalid address", () => {
    expect(() => validateEvmAddress("not-an-address")).toThrow("Invalid EVM address");
  });
});
