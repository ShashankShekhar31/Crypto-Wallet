const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

export function validateEvmAddress(address: string): string {
  const normalized = address.trim();

  if (!EVM_ADDRESS_PATTERN.test(normalized)) {
    throw new Error("Invalid EVM address");
  }

  return normalized;
}

export function isValidEvmAddress(address: string): boolean {
  return EVM_ADDRESS_PATTERN.test(address.trim());
}
