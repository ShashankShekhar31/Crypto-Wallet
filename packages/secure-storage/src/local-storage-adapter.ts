import type { SecureStorageAdapter, SecureStorageKey } from "./types.js";

const STORAGE_PREFIX = "crypto-wallet:secure-storage:";

export class LocalStorageSecureStorageAdapter implements SecureStorageAdapter {
  constructor(private readonly storage: Storage = globalThis.localStorage) {}

  async get(key: SecureStorageKey): Promise<Uint8Array | null> {
    const value = this.storage.getItem(this.storageKey(key));

    if (value === null) {
      return null;
    }

    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  }

  async set(key: SecureStorageKey, value: Uint8Array): Promise<void> {
    let binary = "";

    for (const byte of value) {
      binary += String.fromCharCode(byte);
    }

    this.storage.setItem(this.storageKey(key), btoa(binary));
  }

  async remove(key: SecureStorageKey): Promise<void> {
    this.storage.removeItem(this.storageKey(key));
  }

  async clear(): Promise<void> {
    const keysToRemove: string[] = [];

    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index);

      if (key !== null && key.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      this.storage.removeItem(key);
    }
  }

  private storageKey(key: SecureStorageKey): string {
    return `${STORAGE_PREFIX}${key}`;
  }
}
