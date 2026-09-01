import { validateEvmAddress } from "./address.js";
import type { EvmRpcProvider } from "./rpc.js";

const ERC20_BALANCE_OF_SELECTOR = "70a08231";
const ETH_CALL_METHOD = "eth_call";

export interface Erc20BalanceReader {
  getBalance(tokenAddress: string, ownerAddress: string, blockTag?: string): Promise<bigint>;
}

export class DefaultErc20BalanceReader implements Erc20BalanceReader {
  private readonly provider: EvmRpcProvider;

  constructor(provider: EvmRpcProvider) {
    this.provider = provider;
  }

  async getBalance(
    tokenAddress: string,
    ownerAddress: string,
    blockTag = "latest",
  ): Promise<bigint> {
    const normalizedTokenAddress = validateEvmAddress(tokenAddress);

    const normalizedOwnerAddress = validateEvmAddress(ownerAddress);

    if (!blockTag.trim()) {
      throw new Error("EVM block tag is required");
    }

    const data = encodeErc20BalanceOf(normalizedOwnerAddress);

    const result = await this.provider.request<string>(ETH_CALL_METHOD, [
      {
        to: normalizedTokenAddress,
        data,
      },
      blockTag,
    ]);

    return decodeErc20Uint256(result);
  }
}

export function encodeErc20BalanceOf(ownerAddress: string): string {
  const normalizedAddress = validateEvmAddress(ownerAddress);

  const addressWithoutPrefix = normalizedAddress.slice(2);

  return `0x${ERC20_BALANCE_OF_SELECTOR}${addressWithoutPrefix.padStart(64, "0")}`;
}

export function decodeErc20Uint256(value: string): bigint {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error("Invalid ERC-20 balance response");
  }

  return BigInt(value);
}
