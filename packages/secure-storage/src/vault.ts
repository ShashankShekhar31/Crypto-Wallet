import type {
  SecureStorageAdapter,
  SecureStorageKey,
  SecureStorageOptions,
  SecureVault,
  VaultCipher,
  VaultCipherSession,
  VaultMasterKey,
  VaultState,
} from "./types.js";

const DEFAULT_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
const VAULT_STORAGE_KEY = "wallet-vault";

interface WalletVaultEnvelopeV2 {
  version: 2;
  wrappedMasterKey: number[];
  encryptedValues: number[];
}

export class WalletVault implements SecureVault {
  private readonly adapter: SecureStorageAdapter;
  private readonly cipher: VaultCipher;
  private readonly inactivityTimeoutMs: number;
  private readonly now: () => number;

  private session: VaultCipherSession | null = null;
  private masterKey: VaultMasterKey | null = null;
  private wrappedMasterKey: Uint8Array | null = null;

  private unlocked = false;
  private lastActivityAt: number | null = null;
  private lockedAt: number | null = null;

  private values = new Map<SecureStorageKey, Uint8Array>();

  constructor(adapter: SecureStorageAdapter, cipher: VaultCipher, options: SecureStorageOptions) {
    this.adapter = adapter;
    this.cipher = cipher;
    this.inactivityTimeoutMs = options.inactivityTimeoutMs ?? DEFAULT_INACTIVITY_TIMEOUT_MS;
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

  async hasPersistedData(): Promise<boolean> {
    return (await this.adapter.get(VAULT_STORAGE_KEY)) !== null;
  }

  async unlock(password: string): Promise<void> {
    const encrypted = await this.adapter.get(VAULT_STORAGE_KEY);
    const passwordSession = await this.cipher.createSession(password);

    if (encrypted === null) {
      const masterKey = await this.cipher.createMasterKey();

      try {
        const wrappedMasterKey = await passwordSession.encrypt(masterKey.bytes);

        const masterSession = await this.cipher.createSessionFromMasterKey(masterKey);

        this.masterKey = masterKey;
        this.wrappedMasterKey = new Uint8Array(wrappedMasterKey);
        this.session = masterSession;
        this.values.clear();
        this.unlocked = true;
        this.lastActivityAt = this.now();
        this.lockedAt = null;
      } catch (error) {
        masterKey.wipe();
        throw error;
      }

      return;
    }

    if (isWalletVaultEnvelopeV2(encrypted)) {
      const envelope = parseWalletVaultEnvelopeV2(encrypted);

      const masterKeyBytes = await passwordSession.decrypt(
        Uint8Array.from(envelope.wrappedMasterKey),
      );

      if (masterKeyBytes.length !== 32) {
        throw new Error("Invalid vault master key");
      }

      const masterKey = createMasterKeyFromBytes(masterKeyBytes);

      try {
        const masterSession = await this.cipher.createSessionFromMasterKey(masterKey);

        const plaintext = await masterSession.decrypt(Uint8Array.from(envelope.encryptedValues));

        this.values = deserializeValues(plaintext);
        this.masterKey = masterKey;
        this.wrappedMasterKey = Uint8Array.from(envelope.wrappedMasterKey);
        this.session = masterSession;
        this.unlocked = true;
        this.lastActivityAt = this.now();
        this.lockedAt = null;
      } catch (error) {
        masterKey.wipe();
        throw error;
      }

      return;
    }

    // Legacy v1 vault.
    const plaintext = await passwordSession.decrypt(encrypted);

    this.values = deserializeValues(plaintext);

    const masterKey = await this.cipher.createMasterKey();

    try {
      const wrappedMasterKey = await passwordSession.encrypt(masterKey.bytes);

      const masterSession = await this.cipher.createSessionFromMasterKey(masterKey);

      this.masterKey = masterKey;
      this.wrappedMasterKey = new Uint8Array(wrappedMasterKey);
      this.session = masterSession;
      this.unlocked = true;
      this.lastActivityAt = this.now();
      this.lockedAt = null;

      // Immediately migrate legacy storage to v2.
      await this.persist();
    } catch (error) {
      masterKey.wipe();
      throw error;
    }
  }

  async unlockWithMasterKey(masterKey: VaultMasterKey): Promise<void> {
    if (masterKey.bytes.length !== 32) {
      throw new Error("Invalid vault master key");
    }

    const encrypted = await this.adapter.get(VAULT_STORAGE_KEY);

    if (encrypted === null) {
      throw new Error("Wallet vault has no persisted data");
    }

    if (!isWalletVaultEnvelopeV2(encrypted)) {
      throw new Error("Biometric unlock requires a migrated vault");
    }

    const envelope = parseWalletVaultEnvelopeV2(encrypted);

    const masterSession = await this.cipher.createSessionFromMasterKey(masterKey);

    const plaintext = await masterSession.decrypt(Uint8Array.from(envelope.encryptedValues));

    this.values = deserializeValues(plaintext);
    this.masterKey = masterKey;
    this.wrappedMasterKey = Uint8Array.from(envelope.wrappedMasterKey);
    this.session = masterSession;
    this.unlocked = true;
    this.lastActivityAt = this.now();
    this.lockedAt = null;
  }

  getMasterKey(): VaultMasterKey | null {
    this.checkInactivityTimeout();

    if (!this.unlocked || this.masterKey === null) {
      return null;
    }

    return createMasterKeyFromBytes(this.masterKey.bytes);
  }

  lock(): void {
    this.values.clear();
    this.session = null;

    if (this.masterKey !== null) {
      this.masterKey.wipe();
      this.masterKey = null;
    }

    this.wrappedMasterKey = null;
    this.unlocked = false;
    this.lastActivityAt = null;
    this.lockedAt = this.now();
  }

  async persist(): Promise<void> {
    this.assertUnlocked();

    if (this.session === null || this.wrappedMasterKey === null) {
      throw new Error("Wallet vault session is unavailable");
    }

    const plaintext = serializeValues(this.values);
    const encryptedValues = await this.session.encrypt(plaintext);

    const envelope: WalletVaultEnvelopeV2 = {
      version: 2,
      wrappedMasterKey: Array.from(this.wrappedMasterKey),
      encryptedValues: Array.from(encryptedValues),
    };

    await this.adapter.set(VAULT_STORAGE_KEY, new TextEncoder().encode(JSON.stringify(envelope)));
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

function createMasterKeyFromBytes(bytes: Uint8Array): VaultMasterKey {
  const copy = new Uint8Array(bytes);

  return {
    get bytes(): Uint8Array {
      return copy;
    },

    wipe(): void {
      copy.fill(0);
    },
  };
}

function isWalletVaultEnvelopeV2(value: Uint8Array): boolean {
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(value));

    if (typeof parsed !== "object" || parsed === null) {
      return false;
    }

    const envelope = parsed as Record<string, unknown>;

    return (
      envelope.version === 2 &&
      Array.isArray(envelope.wrappedMasterKey) &&
      Array.isArray(envelope.encryptedValues)
    );
  } catch {
    return false;
  }
}

function parseWalletVaultEnvelopeV2(value: Uint8Array): WalletVaultEnvelopeV2 {
  let parsed: unknown;

  try {
    parsed = JSON.parse(new TextDecoder().decode(value));
  } catch {
    throw new Error("Invalid wallet vault envelope");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid wallet vault envelope");
  }

  const envelope = parsed as Record<string, unknown>;

  if (
    envelope.version !== 2 ||
    !isByteArray(envelope.wrappedMasterKey) ||
    !isByteArray(envelope.encryptedValues)
  ) {
    throw new Error("Invalid wallet vault envelope");
  }

  if (envelope.wrappedMasterKey.length === 0) {
    throw new Error("Invalid wrapped vault master key");
  }

  if (envelope.encryptedValues.length === 0) {
    throw new Error("Invalid encrypted vault values");
  }

  return {
    version: 2,
    wrappedMasterKey: envelope.wrappedMasterKey,
    encryptedValues: envelope.encryptedValues,
  };
}

function copyBytes(value: Uint8Array): Uint8Array {
  return new Uint8Array(value);
}

function serializeValues(values: Map<SecureStorageKey, Uint8Array>): Uint8Array {
  const entries = [...values.entries()].map(([key, value]) => [key, Array.from(value)]);

  return new TextEncoder().encode(JSON.stringify(entries));
}

function deserializeValues(plaintext: Uint8Array): Map<SecureStorageKey, Uint8Array> {
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
          typeof item === "number" && Number.isInteger(item) && item >= 0 && item <= 255,
      )
    ) {
      throw new Error("Invalid wallet vault entry");
    }

    values.set(key, Uint8Array.from(rawValue));
  }

  return values;
}

function isByteArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item): item is number =>
        typeof item === "number" && Number.isInteger(item) && item >= 0 && item <= 255,
    )
  );
}

export { DEFAULT_INACTIVITY_TIMEOUT_MS, serializeValues };
