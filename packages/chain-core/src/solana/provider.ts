import type { SolanaNetworkConfig } from "./types.js";
import type {
  SolanaRpcProvider,
  SolanaRpcProviderOptions,
} from "./rpc.js";

const SOLANA_GENESIS_HASH_METHOD = "getGenesisHash";

export class DefaultSolanaRpcProvider
  implements SolanaRpcProvider
{
  readonly networkId: string;

  private readonly network: SolanaNetworkConfig;
  private readonly transport: SolanaRpcProviderOptions["transport"];
  private readonly rpcUrl: string;

  private constructor(
    network: SolanaNetworkConfig,
    transport: SolanaRpcProviderOptions["transport"],
    rpcUrl: string,
  ) {
    this.network = network;
    this.transport = transport;
    this.rpcUrl = rpcUrl;
    this.networkId = network.id;
  }

  static async create(
    network: SolanaNetworkConfig,
    options: SolanaRpcProviderOptions,
  ): Promise<DefaultSolanaRpcProvider> {
    if (network.rpcUrls.length === 0) {
      throw new Error("Solana network has no RPC URL");
    }

    let lastError: unknown;

    for (const rpcUrl of network.rpcUrls) {
      const provider = new DefaultSolanaRpcProvider(
        network,
        options.transport,
        rpcUrl,
      );

      try {
        await provider.validateNetworkIdentity();

        return provider;
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error(
      "No Solana RPC endpoint passed network identity validation",
      {
        cause: lastError,
      },
    );
  }

  async request<TResponse>(
    method: string,
    params: readonly unknown[] = [],
  ): Promise<TResponse> {
    if (!method.trim()) {
      throw new Error("Solana RPC method is required");
    }

    return this.transport.request<TResponse>(
      this.rpcUrl,
      method,
      params,
    );
  }

  private async validateNetworkIdentity(): Promise<void> {
    const actualGenesisHash =
      await this.transport.request<string>(
        this.rpcUrl,
        SOLANA_GENESIS_HASH_METHOD,
        [],
      );

    if (
      typeof actualGenesisHash !== "string" ||
      !actualGenesisHash.trim()
    ) {
      throw new Error(
        "Invalid Solana genesis hash response",
      );
    }

    if (
      actualGenesisHash.trim() !==
      this.network.genesisHash
    ) {
      throw new Error(
        "Solana RPC endpoint returned unexpected genesis hash",
      );
    }
  }
}