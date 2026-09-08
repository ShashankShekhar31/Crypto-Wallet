import { describe, expect, it } from "vitest";

import { InvalidDAppOriginError, isSameDAppOrigin, normalizeDAppOrigin } from "../origin.js";

describe("normalizeDAppOrigin", () => {
  it("normalizes a valid HTTPS origin", () => {
    expect(normalizeDAppOrigin("https://example.com")).toBe("https://example.com");
  });

  it("normalizes a trailing slash", () => {
    expect(normalizeDAppOrigin("https://example.com/")).toBe("https://example.com");
  });

  it("normalizes hostname casing", () => {
    expect(normalizeDAppOrigin("https://EXAMPLE.COM")).toBe("https://example.com");
  });

  it("preserves an explicit non-default port", () => {
    expect(normalizeDAppOrigin("https://example.com:8443")).toBe("https://example.com:8443");
  });

  it("allows HTTP for local development", () => {
    expect(normalizeDAppOrigin("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("rejects unsupported protocols", () => {
    expect(() => normalizeDAppOrigin("javascript:alert(1)")).toThrow(InvalidDAppOriginError);

    expect(() => normalizeDAppOrigin("data:text/plain,hello")).toThrow(InvalidDAppOriginError);

    expect(() => normalizeDAppOrigin("file:///wallet")).toThrow(InvalidDAppOriginError);
  });

  it("rejects embedded credentials", () => {
    expect(() => normalizeDAppOrigin("https://user:password@example.com")).toThrow(
      InvalidDAppOriginError,
    );
  });

  it("rejects paths", () => {
    expect(() => normalizeDAppOrigin("https://example.com/app")).toThrow(InvalidDAppOriginError);
  });

  it("rejects query strings", () => {
    expect(() => normalizeDAppOrigin("https://example.com?wallet=true")).toThrow(
      InvalidDAppOriginError,
    );
  });

  it("rejects fragments", () => {
    expect(() => normalizeDAppOrigin("https://example.com#connect")).toThrow(
      InvalidDAppOriginError,
    );
  });

  it("rejects empty origins", () => {
    expect(() => normalizeDAppOrigin("")).toThrow(InvalidDAppOriginError);
  });
});

describe("isSameDAppOrigin", () => {
  it("treats equivalent origins as equal", () => {
    expect(isSameDAppOrigin("https://EXAMPLE.COM/", "https://example.com")).toBe(true);
  });

  it("does not equate different origins", () => {
    expect(isSameDAppOrigin("https://example.com", "https://evil.example.com")).toBe(false);
  });

  it("does not equate different ports", () => {
    expect(isSameDAppOrigin("https://example.com:443", "https://example.com:8443")).toBe(false);
  });

  it("rejects invalid origins instead of comparing them", () => {
    expect(() => isSameDAppOrigin("javascript:alert(1)", "https://example.com")).toThrow(
      InvalidDAppOriginError,
    );
  });
});
