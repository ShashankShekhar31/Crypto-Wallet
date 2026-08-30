import { describe, expect, it } from "vitest";

import { ManagedSecretBytes } from "../secret-bytes.js";

describe("ManagedSecretBytes", () => {
  it("defensively copies the input", () => {
    const input = new Uint8Array([1, 2, 3, 4]);
    const secret = new ManagedSecretBytes(input);

    input[0] = 99;

    expect(secret.copy()).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it("returns a defensive copy", () => {
    const secret = new ManagedSecretBytes(new Uint8Array([1, 2, 3, 4]));

    const copy = secret.copy();
    copy[0] = 99;

    expect(secret.copy()).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it("wipes owned bytes", () => {
    const secret = new ManagedSecretBytes(new Uint8Array([1, 2, 3, 4]));

    expect(secret.isWiped).toBe(false);

    secret.wipe();

    expect(secret.isWiped).toBe(true);
  });

  it("rejects access after wiping", () => {
    const secret = new ManagedSecretBytes(new Uint8Array([1, 2, 3, 4]));

    secret.wipe();

    expect(() => secret.copy()).toThrow("Secret bytes have been wiped");
  });

  it("can be wiped more than once", () => {
    const secret = new ManagedSecretBytes(new Uint8Array([1, 2, 3, 4]));

    secret.wipe();
    secret.wipe();

    expect(secret.isWiped).toBe(true);
  });
});