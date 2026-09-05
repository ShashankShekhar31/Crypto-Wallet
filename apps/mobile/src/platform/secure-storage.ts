import * as SecureStore from "expo-secure-store";

import type {
  SecureStorageAdapter,
  SecureStorageKey,
  VaultMasterKey,
} from "@crypto-wallet/secure-storage";

const STORAGE_PREFIX = "crypto-wallet-";
const BIOMETRIC_CREDENTIAL_KEY = `${STORAGE_PREFIX}biometric-credential`;

function getStorageKey(key: SecureStorageKey): string {
  return `${STORAGE_PREFIX}${key}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const byte1 = bytes[index] ?? 0;
    const byte2 = bytes[index + 1];
    const byte3 = bytes[index + 2];

    const value = (byte1 << 16) | ((byte2 ?? 0) << 8) | (byte3 ?? 0);

    result += alphabet[(value >> 18) & 0x3f];
    result += alphabet[(value >> 12) & 0x3f];
    result += byte2 === undefined ? "=" : alphabet[(value >> 6) & 0x3f];
    result += byte3 === undefined ? "=" : alphabet[value & 0x3f];
  }

  return result;
}

function base64ToBytes(value: string): Uint8Array {
  const normalized = value.trim();

  if (normalized.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    throw new Error("Invalid Base64 secure storage value");
  }

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  const outputLength =
    (normalized.length * 3) / 4 -
    (normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0);

  const bytes = new Uint8Array(outputLength);
  let outputIndex = 0;

  for (let index = 0; index < normalized.length; index += 4) {
    const char1 = normalized[index];
    const char2 = normalized[index + 1];
    const char3 = normalized[index + 2];
    const char4 = normalized[index + 3];

    if (char1 === undefined || char2 === undefined) {
      throw new Error("Invalid Base64 secure storage value");
    }

    const value1 = alphabet.indexOf(char1);
    const value2 = alphabet.indexOf(char2);
    const value3 = char3 === "=" ? 0 : alphabet.indexOf(char3 ?? "");
    const value4 = char4 === "=" ? 0 : alphabet.indexOf(char4 ?? "");

    if (
      value1 < 0 ||
      value2 < 0 ||
      (char3 !== "=" && value3 < 0) ||
      (char4 !== "=" && value4 < 0)
    ) {
      throw new Error("Invalid Base64 secure storage value");
    }

    const combined = (value1 << 18) | (value2 << 12) | (value3 << 6) | value4;

    if (outputIndex < bytes.length) {
      bytes[outputIndex] = (combined >> 16) & 0xff;
      outputIndex += 1;
    }

    if (char3 !== "=" && outputIndex < bytes.length) {
      bytes[outputIndex] = (combined >> 8) & 0xff;
      outputIndex += 1;
    }

    if (char4 !== "=" && outputIndex < bytes.length) {
      bytes[outputIndex] = combined & 0xff;
      outputIndex += 1;
    }
  }

  return bytes;
}

export class ExpoSecureStorageAdapter implements SecureStorageAdapter {
  async get(key: SecureStorageKey): Promise<Uint8Array | null> {
    const value = await SecureStore.getItemAsync(getStorageKey(key));

    if (value === null) {
      return null;
    }

    return base64ToBytes(value);
  }

  async set(key: SecureStorageKey, value: Uint8Array): Promise<void> {
    await SecureStore.setItemAsync(getStorageKey(key), bytesToBase64(value));
  }

  async remove(key: SecureStorageKey): Promise<void> {
    await SecureStore.deleteItemAsync(getStorageKey(key));
  }

  async clear(): Promise<void> {
    // SecureStore does not provide a "clear all keys" operation.
    // Wallet-specific keys are removed explicitly by the vault.
  }
}

export async function setBiometricCredential(credential: Uint8Array): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_CREDENTIAL_KEY, bytesToBase64(credential), {
    requireAuthentication: true,
  });
}

export async function getBiometricCredential(): Promise<Uint8Array | null> {
  const value = await SecureStore.getItemAsync(BIOMETRIC_CREDENTIAL_KEY, {
    requireAuthentication: true,
  });

  if (value === null) {
    return null;
  }

  return base64ToBytes(value);
}

export async function removeBiometricCredential(): Promise<void> {
  await SecureStore.deleteItemAsync(BIOMETRIC_CREDENTIAL_KEY);
}

export async function setBiometricMasterKey(masterKey: VaultMasterKey): Promise<void> {
  if (masterKey.bytes.length !== 32) {
    throw new Error("Invalid vault master key");
  }

  await setBiometricCredential(masterKey.bytes);
}

export async function getBiometricMasterKey(): Promise<VaultMasterKey | null> {
  const credential = await getBiometricCredential();

  if (credential === null) {
    return null;
  }

  if (credential.length !== 32) {
    credential.fill(0);
    throw new Error("Invalid biometric vault master key");
  }

  return {
    bytes: credential,

    wipe(): void {
      credential.fill(0);
    },
  };
}

export async function removeBiometricMasterKey(): Promise<void> {
  await removeBiometricCredential();
}
