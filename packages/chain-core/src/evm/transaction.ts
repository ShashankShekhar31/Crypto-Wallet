import { validateEvmAddress } from "./address.js";
import type { EvmNetworkConfig } from "./types.js";

export interface EvmTransactionRequest {
  readonly to: string;
  readonly value?: bigint;
  readonly data?: string;
  readonly nonce: bigint;
  readonly gasLimit: bigint;
  readonly maxFeePerGas: bigint;
  readonly maxPriorityFeePerGas: bigint;
}

export interface EvmUnsignedTransaction {
  readonly type: 2;
  readonly chainId: bigint;
  readonly nonce: bigint;
  readonly maxPriorityFeePerGas: bigint;
  readonly maxFeePerGas: bigint;
  readonly gasLimit: bigint;
  readonly to: string;
  readonly value: bigint;
  readonly data: string;
}

function validateNonNegativeQuantity(
  name: string,
  value: bigint,
): void {
  if (value < 0n) {
    throw new Error(`${name} must be non-negative`);
  }
}

function validateHexData(
  value: string,
): string {
  if (!/^0x(?:[0-9a-fA-F]{2})*$/.test(value)) {
    throw new Error("EVM transaction data must be even-length hexadecimal");
  }

  return value.toLowerCase();
}

export function createEvmUnsignedTransaction(
  network: EvmNetworkConfig,
  request: EvmTransactionRequest,
): EvmUnsignedTransaction {
  if (request.nonce < 0n) {
    throw new Error("EVM transaction nonce must be non-negative");
  }

  validateNonNegativeQuantity(
    "EVM transaction gas limit",
    request.gasLimit,
  );

  validateNonNegativeQuantity(
    "EVM transaction max fee per gas",
    request.maxFeePerGas,
  );

  validateNonNegativeQuantity(
    "EVM transaction max priority fee per gas",
    request.maxPriorityFeePerGas,
  );

  if (
    request.maxPriorityFeePerGas >
    request.maxFeePerGas
  ) {
    throw new Error(
      "EVM transaction max priority fee per gas cannot exceed max fee per gas",
    );
  }

  const value = request.value ?? 0n;

  validateNonNegativeQuantity(
    "EVM transaction value",
    value,
  );

  const to = validateEvmAddress(request.to);

  const data = validateHexData(
    request.data ?? "0x",
  );

  return Object.freeze({
    type: 2 as const,
    chainId: network.chainId,
    nonce: request.nonce,
    maxPriorityFeePerGas:
      request.maxPriorityFeePerGas,
    maxFeePerGas: request.maxFeePerGas,
    gasLimit: request.gasLimit,
    to,
    value,
    data,
  });
}