import { base58 } from "@scure/base";

const SOLANA_PUBLIC_KEY_LENGTH = 32;

export function validateSolanaAddress(address: string): string {
  const normalized = address.trim();

  if (!normalized) {
    throw new Error("Solana address is required");
  }

  try {
    const decoded = base58.decode(normalized);

    if (decoded.length !== SOLANA_PUBLIC_KEY_LENGTH) {
      throw new Error("Invalid Solana address");
    }
  } catch (error) {
    throw new Error("Invalid Solana address", {
      cause: error,
    });
  }

  return normalized;
}

export function isValidSolanaAddress(address: string): boolean {
  try {
    validateSolanaAddress(address);
    return true;
  } catch {
    return false;
  }
}