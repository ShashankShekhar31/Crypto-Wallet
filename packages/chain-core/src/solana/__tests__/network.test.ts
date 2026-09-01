import { describe, expect, it } from "vitest";

import { createSolanaNetworkConfig } from "../network.js";

describe("Solana network configuration", () => {
  it("creates a network configuration", () => {
    const network = createSolanaNetworkConfig({
      id: "solana-devnet",
      name: "Solana Devnet",
      rpcUrls: ["https://api.devnet.solana.com"],
      genesisHash: "test-genesis-hash",
    });

    expect(network.id).toBe("solana-devnet");
    expect(network.name).toBe("Solana Devnet");
    expect(network.rpcUrls).toEqual(["https://api.devnet.solana.com"]);
    expect(network.commitment).toBe("confirmed");
    expect(network.genesisHash).toBe("test-genesis-hash");
  });

  it("accepts an explicit commitment", () => {
    const network = createSolanaNetworkConfig({
      id: "solana-mainnet",
      name: "Solana Mainnet",
      rpcUrls: ["https://api.mainnet-beta.solana.com"],
      commitment: "finalized",
      genesisHash: "test-genesis-hash",
    });

    expect(network.commitment).toBe("finalized");
  });

  it("trims network fields", () => {
    const network = createSolanaNetworkConfig({
      id: "  solana-devnet  ",
      name: "  Solana Devnet  ",
      rpcUrls: ["  https://api.devnet.solana.com  "],
      genesisHash: "  test-genesis-hash  ",
    });

    expect(network.id).toBe("solana-devnet");
    expect(network.name).toBe("Solana Devnet");
    expect(network.rpcUrls[0]).toBe("https://api.devnet.solana.com");
    expect(network.genesisHash).toBe("test-genesis-hash");
  });

  it("rejects an empty network id", () => {
    expect(() =>
      createSolanaNetworkConfig({
        id: "",
        name: "Solana Devnet",
        rpcUrls: ["https://api.devnet.solana.com"],
      }),
    ).toThrow("Solana network id is required");
  });

  it("rejects an empty network name", () => {
    expect(() =>
      createSolanaNetworkConfig({
        id: "solana-devnet",
        name: "",
        rpcUrls: ["https://api.devnet.solana.com"],
      }),
    ).toThrow("Solana network name is required");
  });

  it("rejects a network without RPC URLs", () => {
    expect(() =>
      createSolanaNetworkConfig({
        id: "solana-devnet",
        name: "Solana Devnet",
        rpcUrls: [],
      }),
    ).toThrow("Solana network has no RPC URL");
  });

  it("rejects an invalid RPC URL", () => {
    expect(() =>
      createSolanaNetworkConfig({
        id: "solana-devnet",
        name: "Solana Devnet",
        rpcUrls: ["not-a-url"],
      }),
    ).toThrow("Invalid Solana RPC URL");
  });

  it("rejects an empty RPC URL", () => {
    expect(() =>
      createSolanaNetworkConfig({
        id: "solana-devnet",
        name: "Solana Devnet",
        rpcUrls: [""],
      }),
    ).toThrow("Solana RPC URL is required");
  });
  it("rejects an empty genesis hash", () => {
    expect(() =>
      createSolanaNetworkConfig({
        id: "solana-devnet",
        name: "Solana Devnet",
        rpcUrls: ["https://api.devnet.solana.com"],
        genesisHash: "",
      }),
    ).toThrow("Solana genesis hash is required");
  });
});
