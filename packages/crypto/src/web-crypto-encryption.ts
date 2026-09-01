import type { CryptoKeyMaterial, EncryptionParams } from "./types.js";

export async function encryptAesGcm(
  keyMaterial: CryptoKeyMaterial,
  plaintext: Uint8Array,
  params: EncryptionParams,
): Promise<Uint8Array> {
  if (params.nonce.byteLength !== 12) {
    throw new Error("AES-GCM nonce must be 12 bytes");
  }

  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    toArrayBuffer(keyMaterial.bytes),
    {
      name: "AES-GCM",
    },
    false,
    ["encrypt"],
  );

  const ciphertext = await globalThis.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(params.nonce),
    },
    key,
    toArrayBuffer(plaintext),
  );

  return new Uint8Array(ciphertext);
}

export async function decryptAesGcm(
  keyMaterial: CryptoKeyMaterial,
  ciphertext: Uint8Array,
  params: EncryptionParams,
): Promise<Uint8Array> {
  if (params.nonce.byteLength !== 12) {
    throw new Error("AES-GCM nonce must be 12 bytes");
  }

  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    toArrayBuffer(keyMaterial.bytes),
    {
      name: "AES-GCM",
    },
    false,
    ["decrypt"],
  );

  try {
    const plaintext = await globalThis.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(params.nonce),
      },
      key,
      toArrayBuffer(ciphertext),
    );

    return new Uint8Array(plaintext);
  } catch {
    throw new Error("AES-GCM decryption failed");
  }
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(value.byteLength);
  new Uint8Array(buffer).set(value);
  return buffer;
}
