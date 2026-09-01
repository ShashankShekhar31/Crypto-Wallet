import { describe, expect, it } from "vitest";

import type { WalletAccount } from "@crypto-wallet/shared-types";
import type { WalletRepository } from "../index.js";

class TestWalletRepository implements WalletRepository {
  private readonly wallets = new Map<string, WalletAccount>();

  async create(wallet: WalletAccount): Promise<void> {
    this.wallets.set(wallet.id, wallet);
  }

  async getById(id: string): Promise<WalletAccount | null> {
    return this.wallets.get(id) ?? null;
  }

  async listByUserId(userId: string): Promise<WalletAccount[]> {
    return [...this.wallets.values()].filter((wallet) => wallet.userId === userId);
  }

  async delete(id: string): Promise<void> {
    this.wallets.delete(id);
  }
}

describe("WalletRepository", () => {
  it("supports the wallet repository contract", async () => {
    const repository: WalletRepository = new TestWalletRepository();

    const wallet: WalletAccount = {
      id: "wallet-1",
      userId: "user-1",
      name: "Test Wallet",
      type: "self-custody",
      createdAt: new Date().toISOString(),
    };

    await repository.create(wallet);

    await expect(repository.getById(wallet.id)).resolves.toEqual(wallet);

    await expect(repository.listByUserId(wallet.userId)).resolves.toEqual([wallet]);
  });

  it("returns null for an unknown wallet", async () => {
    const repository: WalletRepository = new TestWalletRepository();

    await expect(repository.getById("missing-wallet")).resolves.toBeNull();
  });

  it("deletes a wallet", async () => {
    const repository: WalletRepository = new TestWalletRepository();

    const wallet: WalletAccount = {
      id: "wallet-1",
      userId: "user-1",
      name: "Test Wallet",
      type: "self-custody",
      createdAt: new Date().toISOString(),
    };

    await repository.create(wallet);
    await repository.delete(wallet.id);

    await expect(repository.getById(wallet.id)).resolves.toBeNull();
  });
});
