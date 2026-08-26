import { describe, expect, it } from "vitest";

import {
  generateRefreshToken,
  hashRefreshToken,
} from "../identity/token.js";

describe("refresh tokens", () => {
  it("generates non-empty random refresh tokens", () => {
    const first = generateRefreshToken();
    const second = generateRefreshToken();

    expect(first).toEqual(expect.any(String));
    expect(first.length).toBeGreaterThan(0);

    expect(second).toEqual(expect.any(String));
    expect(second.length).toBeGreaterThan(0);

    expect(first).not.toBe(second);
  });

  it("produces a deterministic hash for the same token", () => {
    const token = generateRefreshToken();

    const firstHash = hashRefreshToken(token);
    const secondHash = hashRefreshToken(token);

    expect(firstHash).toBe(secondHash);
  });

  it("produces different hashes for different tokens", () => {
    const firstToken = generateRefreshToken();
    const secondToken = generateRefreshToken();

    expect(
      hashRefreshToken(firstToken),
    ).not.toBe(
      hashRefreshToken(secondToken),
    );
  });

  it("does not return the raw token from the hash function", () => {
    const token = generateRefreshToken();
    const hash = hashRefreshToken(token);

    expect(hash).not.toBe(token);
    expect(hash).not.toContain(token);
  });
});
