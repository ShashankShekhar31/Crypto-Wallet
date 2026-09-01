import type { EvmNetworkConfig } from "./types.js";
import { validateEvmChainId } from "./network.js";
import type { EvmRpcProvider, EvmRpcProviderOptions } from "./rpc.js";

const ETH_CHAIN_ID_METHOD = "eth_chainId";

export class DefaultEvmRpcProvider implements EvmRpcProvider {
  readonly networkId: string;

  private readonly network: EvmNetworkConfig;
  private readonly transport: EvmRpcProviderOptions["transport"];
  private readonly rpcUrl: string;

  private constructor(
    network: EvmNetworkConfig,
    transport: EvmRpcProviderOptions["transport"],
    rpcUrl: string,
  ) {
    this.network = network;
    this.transport = transport;
    this.rpcUrl = rpcUrl;
    this.networkId = network.id;
  }

  static async create(
    network: EvmNetworkConfig,
    options: EvmRpcProviderOptions,
  ): Promise<DefaultEvmRpcProvider> {
    if (network.rpcUrls.length === 0) {
      throw new Error("EVM network has no RPC URL");
    }

    let lastError: unknown = undefined;

    for (const rpcUrl of network.rpcUrls) {
      const provider = new DefaultEvmRpcProvider(network, options.transport, rpcUrl);

      try {
        await provider.validateChainIdentity();

        return provider;
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error("No EVM RPC endpoint passed chain identity validation", {
      cause: lastError,
    });
  }

  async request<TResponse>(method: string, params: readonly unknown[] = []): Promise<TResponse> {
    if (!method.trim()) {
      throw new Error("EVM RPC method is required");
    }

    return this.transport.request<TResponse>(this.rpcUrl, method, params);
  }

  private async validateChainIdentity(): Promise<void> {
    const actualChainId = await this.transport.request<string>(
      this.rpcUrl,
      ETH_CHAIN_ID_METHOD,
      [],
    );

    validateEvmChainId(this.network.chainId, actualChainId);
  }
}
