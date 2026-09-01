import { describe, expect, it } from "vitest";

import { Bip39MnemonicService } from "../bip39-mnemonic.js";

describe("Bip39MnemonicService", () => {
  const service = new Bip39MnemonicService();

  it("generates a valid 12-word mnemonic", () => {
    const mnemonic = service.generate(128);

    expect(mnemonic.split(" ")).toHaveLength(12);
    expect(service.validate(mnemonic)).toBe(true);
  });

  it("generates a valid 24-word mnemonic", () => {
    const mnemonic = service.generate(256);

    expect(mnemonic.split(" ")).toHaveLength(24);
    expect(service.validate(mnemonic)).toBe(true);
  });

  it("validates a known BIP-39 mnemonic", () => {
    const mnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    expect(service.validate(mnemonic)).toBe(true);
  });

  it("rejects an invalid mnemonic checksum", () => {
    const mnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon";

    expect(service.validate(mnemonic)).toBe(false);
  });

  it("derives deterministic seed material", async () => {
    const mnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    const first = await service.toSeed(mnemonic);
    const second = await service.toSeed(mnemonic);

    expect(first.copy()).toEqual(second.copy());
    expect(first.copy()).toHaveLength(64);

    first.wipe();
    second.wipe();
  });

  it("supports an optional BIP-39 passphrase", async () => {
    const mnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    const withoutPassphrase = await service.toSeed(mnemonic);
    const withPassphrase = await service.toSeed(mnemonic, "test-passphrase");

    expect(withoutPassphrase.copy()).not.toEqual(withPassphrase.copy());

    withoutPassphrase.wipe();
    withPassphrase.wipe();
  });

  it("rejects invalid mnemonic input before deriving a seed", async () => {
    const invalidMnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon";

    await expect(service.toSeed(invalidMnemonic)).rejects.toThrow("Invalid BIP-39 mnemonic");
  });
  it("matches the official BIP-39 deterministic seed vector", async () => {
    const mnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    const secret = await service.toSeed(mnemonic, "TREZOR");

    const seed = secret.copy();

    const expectedSeed = Uint8Array.from(
      [
        "c55257c360c07c72029aebc1b53c05ed",
        "0362ada38ead3e3e9efa3708e53495531",
        "f09a6987599d18264c1e1c92f2cf1416",
        "30c7a3c4ab7c81b2f001698e7463b04",
      ]
        .join("")
        .match(/.{2}/g)!
        .map((byte) => Number.parseInt(byte, 16)),
    );

    expect(seed).toHaveLength(64);
    expect(seed).toEqual(expectedSeed);

    secret.wipe();
  });
});
