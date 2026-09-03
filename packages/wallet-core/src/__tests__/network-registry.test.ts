import { describe, expect, it } from "vitest";

import { DefaultNetworkRegistry, type NetworkDefinition } from "../network-registry.js";

describe("DefaultNetworkRegistry", () => {
  const bitcoin: NetworkDefinition = {
    id: "bitcoin-mainnet",
    chain: "bitcoin",
    name: "Bitcoin",
    testnet: false,
  };

  const bitcoinTestnet: NetworkDefinition = {
    id: "bitcoin-testnet",
    chain: "bitcoin",
    name: "Bitcoin Testnet",
    testnet: true,
  };

  it("registers and retrieves a network by id", () => {
    const registry = new DefaultNetworkRegistry();

    registry.register(bitcoin);

    expect(registry.getById("bitcoin-mainnet")).toEqual(bitcoin);
  });

  it("returns null when a network does not exist", () => {
    const registry = new DefaultNetworkRegistry();

    expect(registry.getById("unknown")).toBeNull();
  });

  it("lists registered networks", () => {
    const registry = new DefaultNetworkRegistry();

    registry.register(bitcoin);
    registry.register(bitcoinTestnet);

    expect(registry.list()).toEqual([bitcoin, bitcoinTestnet]);
  });

  it("rejects duplicate network ids", () => {
    const registry = new DefaultNetworkRegistry();

    registry.register(bitcoin);

    expect(() => registry.register(bitcoin)).toThrow("Network already registered: bitcoin-mainnet");
  });

  it("does not expose mutable registry state", () => {
    const registry = new DefaultNetworkRegistry();

    registry.register(bitcoin);

    const networks = registry.list();
    networks.pop();

    expect(registry.list()).toEqual([bitcoin]);
  });
});
