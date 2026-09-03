import type { SupportedChain } from "@crypto-wallet/shared-types";

export interface NetworkDefinition {
  readonly id: string;
  readonly chain: SupportedChain;
  readonly name: string;
  readonly testnet: boolean;
}

export interface NetworkRegistry {
  register(network: NetworkDefinition): void;

  getById(id: string): NetworkDefinition | null;

  list(): NetworkDefinition[];
}

export class DefaultNetworkRegistry implements NetworkRegistry {
  private readonly networks = new Map<string, NetworkDefinition>();

  register(network: NetworkDefinition): void {
    if (this.networks.has(network.id)) {
      throw new Error(`Network already registered: ${network.id}`);
    }

    this.networks.set(network.id, network);
  }

  getById(id: string): NetworkDefinition | null {
    return this.networks.get(id) ?? null;
  }

  list(): NetworkDefinition[] {
    return [...this.networks.values()];
  }
}
