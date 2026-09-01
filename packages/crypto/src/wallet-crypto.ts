import { Bip32WalletKeyDeriver } from "./bip32-derivation.js";
import { Bip39MnemonicService } from "./bip39-mnemonic.js";
import { Secp256k1WalletSigner } from "./secp256k1-signer.js";
import type {
  MnemonicService,
  WalletCrypto,
  WalletKeyDeriver,
  WalletSigner,
} from "./wallet-crypto-types.js";

export class DefaultWalletCrypto implements WalletCrypto {
  readonly mnemonic: MnemonicService;
  readonly deriver: WalletKeyDeriver;
  readonly signer: WalletSigner;

  constructor() {
    this.mnemonic = new Bip39MnemonicService();
    this.deriver = new Bip32WalletKeyDeriver();
    this.signer = new Secp256k1WalletSigner();
  }
}
