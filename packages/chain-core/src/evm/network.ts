import type { EvmNetworkConfig } from "./types.js";

export function createEvmNetworkConfig(config: EvmNetworkConfig): EvmNetworkConfig {
  if (!config.id.trim()) {
    throw new Error("EVM network id is required");
  }

  if (!config.name.trim()) {
    throw new Error("EVM network name is required");
  }

  if (config.chainId <= 0n) {
    throw new Error("EVM chain ID must be positive");
  }

  if (!Number.isInteger(config.nativeCurrency.decimals)) {
    throw new Error("Native currency decimals must be an integer");
  }

  if (config.nativeCurrency.decimals < 0) {
    throw new Error("Native currency decimals must be non-negative");
  }

  if (!config.nativeCurrency.symbol.trim()) {
    throw new Error("Native currency symbol is required");
  }

  if (!config.nativeCurrency.name.trim()) {
    throw new Error("Native currency name is required");
  }

  if (config.rpcUrls.length === 0) {
    throw new Error("At least one EVM RPC URL is required");
  }

  for (const rpcUrl of config.rpcUrls) {
    const normalizedUrl = rpcUrl.trim();

    if (!normalizedUrl) {
      throw new Error("EVM RPC URL cannot be empty");
    }

    if (!/^https?:\/\/\S+$/i.test(normalizedUrl)) {
      throw new Error("EVM RPC URL must use HTTP or HTTPS");
    }
  }

  return Object.freeze({
    ...config,
    id: config.id.trim(),
    name: config.name.trim(),
    rpcUrls: Object.freeze(config.rpcUrls.map((rpcUrl) => rpcUrl.trim())),
    nativeCurrency: Object.freeze({
      ...config.nativeCurrency,
      name: config.nativeCurrency.name.trim(),
      symbol: config.nativeCurrency.symbol.trim(),
    }),
  });
}

export function parseEvmChainId(value: string): bigint {
  const normalized = value.trim();

  if (!/^0x[0-9a-fA-F]+$/.test(normalized)) {
    throw new Error("Invalid EVM chain ID");
  }

  const chainId = BigInt(normalized);

  if (chainId <= 0n) {
    throw new Error("EVM chain ID must be positive");
  }

  return chainId;
}

export function validateEvmChainId(expectedChainId: bigint, actualChainId: string): void {
  const parsedChainId = parseEvmChainId(actualChainId);

  if (parsedChainId !== expectedChainId) {
    throw new Error(
      `EVM chain ID mismatch: expected ${expectedChainId}, received ${parsedChainId}`,
    );
  }
}
