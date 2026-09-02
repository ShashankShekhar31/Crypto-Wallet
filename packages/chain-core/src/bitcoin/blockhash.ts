function normalizeBlockhash(value: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error("Bitcoin blockhash is required");
  }

  return normalized;
}

export function isValidBitcoinBlockhash(value: string): boolean {
  const normalized = normalizeBlockhash(value);

  return normalized.length === 64 && /^[0-9a-fA-F]+$/.test(normalized);
}

export function validateBitcoinBlockhash(value: string): string {
  const normalized = normalizeBlockhash(value);

  if (!isValidBitcoinBlockhash(normalized)) {
    throw new Error("Invalid Bitcoin blockhash");
  }

  return normalized;
}
