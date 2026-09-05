export type SecureStorageKey = string;

export interface SecureStorageAdapter {
  get(key: SecureStorageKey): Promise<Uint8Array | null>;
  set(key: SecureStorageKey, value: Uint8Array): Promise<void>;
  remove(key: SecureStorageKey): Promise<void>;
  clear(): Promise<void>;
}

export interface VaultCipher {
  createSession(password: string): Promise<VaultCipherSession>;

  createMasterKey(): Promise<VaultMasterKey>;

  createSessionFromMasterKey(masterKey: VaultMasterKey): Promise<VaultCipherSession>;
}

export interface VaultMasterKey {
  readonly bytes: Uint8Array;
  wipe(): void;
}

export interface VaultCipherSession {
  encrypt(plaintext: Uint8Array): Promise<Uint8Array>;
  decrypt(ciphertext: Uint8Array): Promise<Uint8Array>;
}

export interface VaultState {
  locked: boolean;
  lastActivityAt: number | null;
  lockedAt: number | null;
}

export interface SecureStorageOptions {
  inactivityTimeoutMs?: number;
  now?: () => number;
}

export interface SecureVault {
  readonly state: VaultState;

  hasPersistedData(): Promise<boolean>;

  unlock(password: string): Promise<void>;

  unlockWithMasterKey(masterKey: VaultMasterKey): Promise<void>;

  getMasterKey(): VaultMasterKey | null;

  lock(): void;

  persist(): Promise<void>;

  get(key: SecureStorageKey): Uint8Array | null;

  set(key: SecureStorageKey, value: Uint8Array): void;

  remove(key: SecureStorageKey): void;

  touch(): void;
}
