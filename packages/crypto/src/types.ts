export interface CryptoProvider {
  randomBytes(length: number): Uint8Array;

  hash(
    algorithm: "SHA-256" | "SHA-512",
    data: Uint8Array,
  ): Promise<Uint8Array>;
}

export interface KeyDerivationParams {
  salt: Uint8Array;
  iterations: number;
  keyLength: number;
}

export interface EncryptionParams {
  nonce: Uint8Array;
}

export interface EncryptionProvider {
  encrypt(
    key: CryptoKeyMaterial,
    plaintext: Uint8Array,
    params: EncryptionParams,
  ): Promise<Uint8Array>;

  decrypt(
    key: CryptoKeyMaterial,
    ciphertext: Uint8Array,
    params: EncryptionParams,
  ): Promise<Uint8Array>;
}

export interface CryptoKeyMaterial {
  readonly bytes: Uint8Array;
}

export interface KeyDerivationProvider {
  deriveKey(
    password: string,
    params: KeyDerivationParams,
  ): Promise<CryptoKeyMaterial>;
}