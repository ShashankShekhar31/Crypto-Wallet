import type {
  SecureStorageAdapter,
  SecureStorageKey,
  SecureStorageOptions,
  SecureVault,
  VaultCipher,
  VaultCipherSession,
  VaultState,
} from "./types.js";

const DEFAULT_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

export class WalletVault implements SecureVault {
  private readonly adapter: SecureStorageAdapter;
  private readonly cipher: VaultCipher;
  private session: VaultCipherSession | null = null;
  private readonly inactivityTimeoutMs: number;
  private readonly now: () => number;

  private unlocked = false;
  private lastActivityAt: number | null = null;
  private lockedAt: number | null = null;
  private values = new Map<SecureStorageKey, Uint8Array>();

  constructor(
    adapter: SecureStorageAdapter,
    cipher: VaultCipher,
    options: SecureStorageOptions,
  ) {
    this.adapter = adapter;
    this.cipher = cipher;
    this.inactivityTimeoutMs =
      options.inactivityTimeoutMs ?? DEFAULT_INACTIVITY_TIMEOUT_MS;
    this.now = options.now ?? Date.now;
  }

  get state(): VaultState {
    this.checkInactivityTimeout();

    return {
      locked: !this.unlocked,
      lastActivityAt: this.lastActivityAt,
      lockedAt: this.lockedAt,
    };
  }

  async unlock(password: string): Promise<void> {
    const encrypted = await this.adapter.get("wallet-vault");

    const session = await this.cipher.createSession(password);

    if (encrypted === null) {
      this.session = session;
      this.unlocked = true;
      this.lastActivityAt = this.now();
      this.lockedAt = null;
      this.values.clear();
      return;
    }

    const plaintext = await session.decrypt(encrypted);

    this.values = deserializeValues(plaintext);
    this.session = session;
    this.unlocked = true;
    this.lastActivityAt = this.now();
    this.lockedAt = null;
  }

  lock(): void {
    this.values.clear();
    this.session = null;
    this.unlocked = false;
    this.lastActivityAt = null;
    this.lockedAt = this.now();
  }

  async persist(): Promise<void> {
    this.assertUnlocked();

    if (this.session === null) {
      throw new Error("Wallet vault session is unavailable");
    }

    const plaintext = serializeValues(this.values);
    const encrypted = await this.session.encrypt(plaintext);

    await this.adapter.set("wallet-vault", encrypted);
}

  get(key: SecureStorageKey): Uint8Array | null {
    this.assertUnlocked();

    const value = this.values.get(key);

    if (value === undefined) {
      return null;
    }

    this.touch();
    return copyBytes(value);
  }

  set(key: SecureStorageKey, value: Uint8Array): void {
    this.assertUnlocked();

    this.values.set(key, copyBytes(value));
    this.touch();
  }

  remove(key: SecureStorageKey): void {
    this.assertUnlocked();

    this.values.delete(key);
    this.touch();
  }

  touch(): void {
    this.assertUnlocked();
    this.lastActivityAt = this.now();
  }

  private assertUnlocked(): void {
    this.checkInactivityTimeout();

    if (!this.unlocked) {
      throw new Error("Wallet vault is locked");
    }
  }

  private checkInactivityTimeout(): void {
    if (!this.unlocked || this.lastActivityAt === null) {
      return;
    }

    if (this.now() - this.lastActivityAt >= this.inactivityTimeoutMs) {
      this.lock();
    }
  }
}

function copyBytes(value: Uint8Array): Uint8Array {
  return new Uint8Array(value);
}

function serializeValues(
  values: Map<SecureStorageKey, Uint8Array>,
): Uint8Array {
  const entries = [...values.entries()].map(([key, value]) => [
    key,
    Array.from(value),
  ]);

  return new TextEncoder().encode(JSON.stringify(entries));
}

function deserializeValues(
  plaintext: Uint8Array,
): Map<SecureStorageKey, Uint8Array> {
  const parsed: unknown = JSON.parse(new TextDecoder().decode(plaintext));

  if (!Array.isArray(parsed)) {
    throw new Error("Invalid wallet vault payload");
  }

  const values = new Map<SecureStorageKey, Uint8Array>();

  for (const entry of parsed) {
    if (!Array.isArray(entry) || entry.length !== 2) {
      throw new Error("Invalid wallet vault entry");
    }

    const [key, rawValue] = entry;

    if (
      typeof key !== "string" ||
      !Array.isArray(rawValue) ||
      !rawValue.every(
        (item): item is number =>
          typeof item === "number" &&
          Number.isInteger(item) &&
          item >= 0 &&
          item <= 255,
      )
    ) {
      throw new Error("Invalid wallet vault entry");
    }

    values.set(key, Uint8Array.from(rawValue));
  }

  return values;
}

export { DEFAULT_INACTIVITY_TIMEOUT_MS, serializeValues };