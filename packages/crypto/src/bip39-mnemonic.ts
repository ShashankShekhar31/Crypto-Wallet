import {
  generateMnemonic,
  mnemonicToSeed,
  validateMnemonic,
} from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";

import { ManagedSecretBytes } from "./secret-bytes.js";
import type {
  MnemonicService,
  MnemonicStrength,
  SecretBytes,
} from "./wallet-crypto-types.js";

export class Bip39MnemonicService implements MnemonicService {
  generate(strength: MnemonicStrength = 256): string {
    return generateMnemonic(wordlist, strength);
  }

  validate(mnemonic: string): boolean {
    return validateMnemonic(mnemonic, wordlist);
  }

  async toSeed(
    mnemonic: string,
    passphrase?: string,
  ): Promise<SecretBytes> {
    if (!this.validate(mnemonic)) {
      throw new Error("Invalid BIP-39 mnemonic");
    }

    const seed = await mnemonicToSeed(mnemonic, passphrase);

    return new ManagedSecretBytes(seed);
  }
}