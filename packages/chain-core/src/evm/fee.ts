import { parseEvmQuantity } from "./balance.js";
import type { EvmRpcProvider } from "./rpc.js";
import type { EvmTransactionRequest, EvmUnsignedTransaction } from "./transaction.js";

const ETH_ESTIMATE_GAS_METHOD = "eth_estimateGas";
const ETH_GAS_PRICE_METHOD = "eth_gasPrice";
const ETH_MAX_PRIORITY_FEE_METHOD = "eth_maxPriorityFeePerGas";

export interface EvmFeeEstimate {
  readonly gasLimit: bigint;
  readonly gasPrice: bigint;
  readonly maxPriorityFeePerGas: bigint;
  readonly maxFeePerGas: bigint;
}

export async function estimateEvmTransactionFees(
  provider: EvmRpcProvider,
  transaction: EvmTransactionRequest | EvmUnsignedTransaction,
): Promise<EvmFeeEstimate> {
  const gasLimit = await provider.request<string>(ETH_ESTIMATE_GAS_METHOD, [
    {
      to: transaction.to,
      value: toRpcQuantity(transaction.value ?? 0n),
      data: transaction.data ?? "0x",
    },
  ]);

  const gasPrice = await provider.request<string>(ETH_GAS_PRICE_METHOD, []);

  const maxPriorityFeePerGas = await provider.request<string>(ETH_MAX_PRIORITY_FEE_METHOD, []);

  const parsedGasLimit = parseEvmQuantity(gasLimit);

  const parsedGasPrice = parseEvmQuantity(gasPrice);

  const parsedMaxPriorityFeePerGas = parseEvmQuantity(maxPriorityFeePerGas);

  if (parsedGasLimit === 0n) {
    throw new Error("EVM gas estimate must be greater than zero");
  }

  if (parsedGasPrice === 0n) {
    throw new Error("EVM gas price must be greater than zero");
  }

  if (parsedMaxPriorityFeePerGas > parsedGasPrice) {
    throw new Error("EVM priority fee cannot exceed gas price");
  }

  return Object.freeze({
    gasLimit: parsedGasLimit,
    gasPrice: parsedGasPrice,
    maxPriorityFeePerGas: parsedMaxPriorityFeePerGas,
    maxFeePerGas: parsedGasPrice,
  });
}

function toRpcQuantity(value: bigint): string {
  if (value < 0n) {
    throw new Error("EVM transaction value must be non-negative");
  }

  return `0x${value.toString(16)}`;
}
