import type { WalletCrypto } from "@crypto-wallet/crypto";

import type { SecureVault, VaultState } from "@crypto-wallet/secure-storage";

import type { WalletLifecycle } from "./wallet-lifecycle.js";
import type { BitcoinReceiveAddressOptions } from "./receive-address.js";

import type { BitcoinSendPreview, BitcoinSendRequest } from "./bitcoin-send.js";

import type {
  BitcoinSignedTransaction,
  BitcoinSendSigningRequest,
} from "./bitcoin-send-signing.js";

import type { BitcoinTransactionActivity } from "@crypto-wallet/chain-core";
import type { BitcoinActivityRequest } from "./bitcoin-activity.js";
export interface WalletSession {
  readonly vault: SecureVault;
  readonly crypto: WalletCrypto;
  readonly lifecycle: WalletLifecycle;
  readonly state: VaultState;

  unlock(password: string): Promise<void>;
  lock(): void;
  persist(): Promise<void>;

  getBitcoinReceiveAddress(options: BitcoinReceiveAddressOptions): Promise<string>;
  createBitcoinSendPreview(request: BitcoinSendRequest): Promise<BitcoinSendPreview>;
  signBitcoinTransaction(request: BitcoinSendSigningRequest): Promise<BitcoinSignedTransaction>;
  getBitcoinActivity(
    request: BitcoinActivityRequest,
  ): Promise<readonly BitcoinTransactionActivity[]>;
}
