import { describe, expect, it } from "vitest";

import { LocalStorageSecureStorageAdapter } from "../index.js";

class FakeStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  clear(): void {
    this.values.clear();
  }

  has(key: string): boolean {
    return this.values.has(key);
  }
}

describe("LocalStorageSecureStorageAdapter", () => {
  it("stores and retrieves binary data", async () => {
    const storage = new FakeStorage();
    const adapter = new LocalStorageSecureStorageAdapter(storage);

    const value = new Uint8Array([0, 1, 2, 127, 128, 254, 255]);

    await adapter.set("wallet-vault", value);

    expect(await adapter.get("wallet-vault")).toEqual(value);
  });

  it("returns null for a missing key", async () => {
    const storage = new FakeStorage();
    const adapter = new LocalStorageSecureStorageAdapter(storage);

    expect(await adapter.get("missing")).toBeNull();
  });

  it("returns a defensive copy", async () => {
    const storage = new FakeStorage();
    const adapter = new LocalStorageSecureStorageAdapter(storage);

    const value = new Uint8Array([1, 2, 3]);

    await adapter.set("wallet-vault", value);

    const first = await adapter.get("wallet-vault");

    expect(first).not.toBeNull();

    if (first !== null) {
      first[0] = 99;
    }

    expect(await adapter.get("wallet-vault")).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("removes only the requested key", async () => {
    const storage = new FakeStorage();
    const adapter = new LocalStorageSecureStorageAdapter(storage);

    await adapter.set("wallet-vault", new Uint8Array([1]));
    await adapter.set("other-secret", new Uint8Array([2]));

    await adapter.remove("wallet-vault");

    expect(await adapter.get("wallet-vault")).toBeNull();
    expect(await adapter.get("other-secret")).toEqual(new Uint8Array([2]));
  });

  it("clears secure-storage data without clearing unrelated storage", async () => {
    const storage = new FakeStorage();

    storage.setItem("application-setting", "keep-me");

    const adapter = new LocalStorageSecureStorageAdapter(storage);

    await adapter.set("wallet-vault", new Uint8Array([1, 2, 3]));
    await adapter.set("session-data", new Uint8Array([4, 5, 6]));

    await adapter.clear();

    expect(await adapter.get("wallet-vault")).toBeNull();
    expect(await adapter.get("session-data")).toBeNull();
    expect(storage.getItem("application-setting")).toBe("keep-me");
  });

  it("preserves empty binary values", async () => {
    const storage = new FakeStorage();
    const adapter = new LocalStorageSecureStorageAdapter(storage);

    const value = new Uint8Array();

    await adapter.set("wallet-vault", value);

    expect(await adapter.get("wallet-vault")).toEqual(new Uint8Array());
  });
});
