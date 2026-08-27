import { describe, expect, it } from "vitest";

import {
  generateRecoveryCodes,
  hashRecoveryCode,
} from "../identity/recovery-code.js";

describe("Recovery codes", () => {
  it("generates the requested number of unique codes", () => {
    const codes = generateRecoveryCodes(10);

    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);

    for (const code of codes) {
      expect(code).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{8}$/,
      );
    }
  });

  it("generates different codes across calls", () => {
    const first = generateRecoveryCodes(10);
    const second = generateRecoveryCodes(10);

    expect(first).not.toEqual(second);
  });

  it("hashes the same code deterministically", () => {
    const code =
      "a81f29c4-7b31d9e2-4f90c123-8e7a51bc";

    expect(hashRecoveryCode(code)).toBe(
      hashRecoveryCode(code),
    );
  });

  it("produces a fixed-length hash", () => {
    const code = generateRecoveryCodes(1)[0];

    if (!code) {
      throw new Error("Recovery code was not generated");
    }

    expect(hashRecoveryCode(code)).toMatch(
      /^[0-9a-f]{64}$/,
    );
  });

  it("produces different hashes for different codes", () => {
    const codes = generateRecoveryCodes(2);

    const first = codes[0];
    const second = codes[1];

    if (!first || !second) {
      throw new Error("Recovery codes were not generated");
    }

    expect(hashRecoveryCode(first)).not.toBe(
      hashRecoveryCode(second),
    );
  });

  it("rejects invalid generation counts", () => {
    expect(() => generateRecoveryCodes(0)).toThrow(
      "Recovery code count must be greater than zero",
    );
  });

  it("rejects an empty recovery code", () => {
    expect(() => hashRecoveryCode("")).toThrow(
      "Recovery code must be a non-empty string",
    );
  });
});