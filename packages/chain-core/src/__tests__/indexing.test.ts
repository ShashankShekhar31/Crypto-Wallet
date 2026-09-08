import { describe, expect, it } from "vitest";

import type {
  BlockchainDataSource,
  BlockchainIndexer,
  IndexingCheckpoint,
  ProviderConsistencyChecker,
} from "../indexing.js";

describe("indexing boundaries", () => {
  it("represents blockchain data independently from wallet/account state", async () => {
    const source: BlockchainDataSource<{ blockHeight: number }> = {
      async getLatest() {
        return {
          blockHeight: 100,
        };
      },
    };

    await expect(source.getLatest()).resolves.toEqual({
      blockHeight: 100,
    });
  });

  it("supports durable indexing checkpoints", async () => {
    let checkpoint: IndexingCheckpoint | undefined;

    const indexer: BlockchainIndexer<string> = {
      async getCheckpoint() {
        return checkpoint;
      },

      async index(from, to) {
        return [`${from}->${to}`];
      },

      async saveCheckpoint(nextCheckpoint) {
        checkpoint = nextCheckpoint;
      },
    };

    expect(await indexer.getCheckpoint()).toBeUndefined();

    const indexed = await indexer.index("100", "110");

    expect(indexed).toEqual(["100->110"]);

    await indexer.saveCheckpoint({
      networkId: "ethereum-mainnet",
      cursor: "110",
      blockHeight: 110,
      blockHash: "0xblock110",
    });

    await expect(indexer.getCheckpoint()).resolves.toEqual({
      networkId: "ethereum-mainnet",
      cursor: "110",
      blockHeight: 110,
      blockHash: "0xblock110",
    });
  });

  it("represents provider consistency independently from indexed data", async () => {
    const checker: ProviderConsistencyChecker = {
      async check() {
        return {
          consistent: true,
          providerId: "primary",
        };
      },
    };

    await expect(checker.check()).resolves.toEqual({
      consistent: true,
      providerId: "primary",
    });
  });
});