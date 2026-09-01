import { describe, expect, it } from "vitest";

import {
  Bip32WalletKeyDeriver,
  Bip39MnemonicService,
  DefaultWalletCrypto,
  Secp256k1WalletSigner,
} from "../index.js";

describe("DefaultWalletCrypto", () => {
  it("composes the wallet cryptographic services", () => {
    const crypto = new DefaultWalletCrypto();

    expect(crypto.mnemonic).toBeInstanceOf(Bip39MnemonicService);
    expect(crypto.deriver).toBeInstanceOf(Bip32WalletKeyDeriver);
    expect(crypto.signer).toBeInstanceOf(Secp256k1WalletSigner);
  });

  it("generates and validates a mnemonic through the composed service", () => {
    const crypto = new DefaultWalletCrypto();

    const mnemonic = crypto.mnemonic.generate(128);

    expect(mnemonic.split(" ")).toHaveLength(12);
    expect(crypto.mnemonic.validate(mnemonic)).toBe(true);
  });
});
