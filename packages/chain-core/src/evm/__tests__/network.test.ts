import { describe, expect, it } from "vitest";

import { createEvmNetworkConfig, parseEvmChainId, validateEvmChainId } from "../network.js";

describe("EVM network configuration", () => {
  const validConfig = {
    id: "ethereum-mainnet",
    name: "Ethereum Mainnet",
    chainId: 1n,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: ["https://rpc.example.com", "https://backup.example.com"],
  };

  it("creates a valid EVM network configuration", () => {
    const config = createEvmNetworkConfig(validConfig);

    expect(config.id).toBe("ethereum-mainnet");
    expect(config.chainId).toBe(1n);
    expect(config.rpcUrls).toEqual(["https://rpc.example.com", "https://backup.example.com"]);
  });

  it("trims configuration strings", () => {
    const config = createEvmNetworkConfig({
      ...validConfig,
      id: " ethereum-mainnet ",
      name: " Ethereum Mainnet ",
      rpcUrls: [" https://rpc.example.com "],
      nativeCurrency: {
        ...validConfig.nativeCurrency,
        name: " Ether ",
        symbol: " ETH ",
      },
    });

    expect(config.id).toBe("ethereum-mainnet");
    expect(config.name).toBe("Ethereum Mainnet");
    expect(config.rpcUrls).toEqual(["https://rpc.example.com"]);
    expect(config.nativeCurrency.name).toBe("Ether");
    expect(config.nativeCurrency.symbol).toBe("ETH");
  });

  it("rejects a missing network id", () => {
    expect(() =>
      createEvmNetworkConfig({
        ...validConfig,
        id: " ",
      }),
    ).toThrow("EVM network id is required");
  });

  it("rejects a non-positive chain id", () => {
    expect(() =>
      createEvmNetworkConfig({
        ...validConfig,
        chainId: 0n,
      }),
    ).toThrow("EVM chain ID must be positive");
  });

  it("rejects an empty RPC URL list", () => {
    expect(() =>
      createEvmNetworkConfig({
        ...validConfig,
        rpcUrls: [],
      }),
    ).toThrow("At least one EVM RPC URL is required");
  });

  it("rejects an invalid RPC URL", () => {
    expect(() =>
      createEvmNetworkConfig({
        ...validConfig,
        rpcUrls: ["ftp://rpc.example.com"],
      }),
    ).toThrow("EVM RPC URL must use HTTP or HTTPS");
  });

  it("parses hexadecimal chain IDs", () => {
    expect(parseEvmChainId("0x1")).toBe(1n);
    expect(parseEvmChainId("0x89")).toBe(137n);
    expect(parseEvmChainId("0xA4B1")).toBe(42161n);
  });

  it("rejects malformed chain IDs", () => {
    expect(() => parseEvmChainId("1")).toThrow("Invalid EVM chain ID");

    expect(() => parseEvmChainId("ethereum")).toThrow("Invalid EVM chain ID");
  });

  it("accepts a matching RPC chain ID", () => {
    expect(() => validateEvmChainId(1n, "0x1")).not.toThrow();
  });

  it("rejects an RPC chain ID mismatch", () => {
    expect(() => validateEvmChainId(1n, "0x89")).toThrow(
      "EVM chain ID mismatch: expected 1, received 137",
    );
  });

  it("returns immutable network configuration", () => {
    const config = createEvmNetworkConfig(validConfig);

    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.nativeCurrency)).toBe(true);
    expect(Object.isFrozen(config.rpcUrls)).toBe(true);
  });
  it("accepts a local EVM test node RPC URL", () => {
    const config = createEvmNetworkConfig({
      ...validConfig,
      rpcUrls: ["http://127.0.0.1:8545"],
    });

    expect(config.rpcUrls).toEqual(["http://127.0.0.1:8545"]);
  });
});
