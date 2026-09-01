import { validateEvmAddress } from "./address.js";
import type { EvmRpcProvider } from "./rpc.js";

const ETH_GET_BALANCE_METHOD = "eth_getBalance";

export interface EvmBalanceReader {
  getNativeBalance(
    address: string,
    blockTag?: string,
  ): Promise<bigint>;
}

export class DefaultEvmBalanceReader implements EvmBalanceReader {
  private readonly provider: EvmRpcProvider;

  constructor(provider: EvmRpcProvider) {
    this.provider = provider;
  }

  async getNativeBalance(
    address: string,
    blockTag = "latest",
  ): Promise<bigint> {
    const normalizedAddress = validateEvmAddress(address);

    if (!blockTag.trim()) {
      throw new Error("EVM block tag is required");
    }

    const result = await this.provider.request<string>(
      ETH_GET_BALANCE_METHOD,
      [normalizedAddress, blockTag],
    );

    return parseEvmQuantity(result);
  }
}

export function parseEvmQuantity(value: string): bigint {
  if (!/^0x[0-9a-fA-F]+$/.test(value)) {
    throw new Error("Invalid EVM quantity");
  }

  return BigInt(value);
}