import type { CryptoProvider, KeyDerivationParams, CryptoKeyMaterial } from "./types.js";

export class WebCryptoProvider implements CryptoProvider {
  randomBytes(length: number): Uint8Array {
    if (!Number.isInteger(length) || length <= 0) {
      throw new Error("Random byte length must be a positive integer");
    }

    const bytes = new Uint8Array(length);
    globalThis.crypto.getRandomValues(bytes);

    return bytes;
  }

  async hash(algorithm: "SHA-256" | "SHA-512", data: Uint8Array): Promise<Uint8Array> {
    const buffer = new ArrayBuffer(data.byteLength);
    new Uint8Array(buffer).set(data);

    const digest = await globalThis.crypto.subtle.digest(algorithm, buffer);

    return new Uint8Array(digest);
  }

  async deriveKey(password: string, params: KeyDerivationParams): Promise<CryptoKeyMaterial> {
    if (!password) {
      throw new Error("Password is required");
    }

    if (!Number.isInteger(params.iterations) || params.iterations <= 0) {
      throw new Error("PBKDF2 iterations must be a positive integer");
    }

    if (!Number.isInteger(params.keyLength) || params.keyLength <= 0) {
      throw new Error("Key length must be a positive integer");
    }

    if (params.salt.byteLength === 0) {
      throw new Error("PBKDF2 salt must not be empty");
    }

    const passwordBytes = new TextEncoder().encode(password);

    const passwordBuffer = new ArrayBuffer(passwordBytes.byteLength);
    new Uint8Array(passwordBuffer).set(passwordBytes);

    const key = await globalThis.crypto.subtle.importKey("raw", passwordBuffer, "PBKDF2", false, [
      "deriveBits",
    ]);

    const saltBuffer = new ArrayBuffer(params.salt.byteLength);
    new Uint8Array(saltBuffer).set(params.salt);

    const derivedBits = await globalThis.crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: saltBuffer,
        iterations: params.iterations,
        hash: "SHA-256",
      },
      key,
      params.keyLength * 8,
    );

    return {
      bytes: new Uint8Array(derivedBits),
    };
  }
}
