import type {
  SecureStorageAdapter,
  SecureStorageKey,
} from "./types.js";

export class MemorySecureStorageAdapter
  implements SecureStorageAdapter
{
  private readonly values = new Map<
    SecureStorageKey,
    Uint8Array
  >();

  async get(key: SecureStorageKey): Promise<Uint8Array | null> {
    const value = this.values.get(key);

    return value === undefined
      ? null
      : new Uint8Array(value);
  }

  async set(
    key: SecureStorageKey,
    value: Uint8Array,
  ): Promise<void> {
    this.values.set(key, new Uint8Array(value));
  }

  async remove(key: SecureStorageKey): Promise<void> {
    this.values.delete(key);
  }

  async clear(): Promise<void> {
    this.values.clear();
  }
}