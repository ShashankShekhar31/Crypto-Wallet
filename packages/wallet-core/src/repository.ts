import type { WalletAccount } from "@crypto-wallet/shared-types";

export interface WalletRepository {
  create(wallet: WalletAccount): Promise<void>;

  getById(id: string): Promise<WalletAccount | null>;

  listByUserId(userId: string): Promise<WalletAccount[]>;

  delete(id: string): Promise<void>;
}
