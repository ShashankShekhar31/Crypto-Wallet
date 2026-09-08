import { describe, expect, it } from "vitest";
import { IndexingPipeline } from "../indexing-pipeline.js";

import type {
  BlockchainDataBatch,
  BlockchainDataReader,
  BlockchainDataStore,
  IndexingCheckpoint,
} from "../indexing.js";

function createReader(
  handler: (from: string, to: string) => Promise<readonly string[]>,
  networkId = "ethereum-mainnet",
): BlockchainDataReader<string> {
  return {
    async read(from, to): Promise<BlockchainDataBatch<string>> {
      const items = await handler(from, to);

      return {
        items,
        checkpoint: {
          networkId,
          cursor: to,
          blockHeight: Number(to),
          blockHash: to,
        },
      };
    },
  };
}

function createStore() {
  const writes: string[][] = [];
  const checkpoints: IndexingCheckpoint[] = [];

  const store: BlockchainDataStore<string> = {
    async write(items) {
      writes.push([...items]);
    },

    async getCheckpoint() {
      return checkpoints.at(-1);
    },

    async saveCheckpoint(checkpoint) {
      checkpoints.push(checkpoint);
    },
  };

  return {
    store,
    writes,
    checkpoints,
  };
}

describe("IndexingPipeline", () => {
  it("processes blockchain data in batches", async () => {
    const calls: Array<[string, string]> = [];

    const reader = createReader(async (from, to) => {
      calls.push([from, to]);

      return [`block-${from}`, `block-${to}`];
    });

    const { store, writes, checkpoints } = createStore();

    const pipeline = new IndexingPipeline(reader, store, {
      networkId: "ethereum-mainnet",
      batchSize: 10,
      maxRetries: 0,
    });

    const result = await pipeline.backfill("100", "125");

    expect(result).toEqual({
      batchesProcessed: 3,
      itemsProcessed: 6,
      finalCursor: "125",
    });

    expect(calls).toEqual([
      ["100", "110"],
      ["110", "120"],
      ["120", "125"],
    ]);

    expect(writes).toEqual([
      ["block-100", "block-110"],
      ["block-110", "block-120"],
      ["block-120", "block-125"],
    ]);

    expect(checkpoints).toEqual([
      {
        networkId: "ethereum-mainnet",
        cursor: "110",
        blockHeight: 110,
        blockHash: "110",
      },
      {
        networkId: "ethereum-mainnet",
        cursor: "120",
        blockHeight: 120,
        blockHash: "120",
      },
      {
        networkId: "ethereum-mainnet",
        cursor: "125",
        blockHeight: 125,
        blockHash: "125",
      },
    ]);
  });

  it("persists data before advancing the checkpoint", async () => {
    const events: string[] = [];

    const reader = createReader(async () => {
      events.push("read");
      return ["item"];
    }, "bitcoin-mainnet");

    const { checkpoints, store } = createStore();

    const trackingStore: BlockchainDataStore<string> = {
      async write(items) {
        events.push(`write:${items.join(",")}`);
        await store.write(items);
      },

      async getCheckpoint() {
        return store.getCheckpoint();
      },

      async saveCheckpoint(checkpoint) {
        events.push(`checkpoint:${checkpoint.cursor}`);
        await store.saveCheckpoint(checkpoint);
      },
    };

    const pipeline = new IndexingPipeline(reader, trackingStore, {
      networkId: "bitcoin-mainnet",
      batchSize: 10,
      maxRetries: 0,
    });

    await pipeline.backfill("100", "110");

    expect(events).toEqual(["read", "write:item", "checkpoint:110"]);

    expect(checkpoints).toHaveLength(1);
  });

  it("retries a failed batch read", async () => {
    let attempts = 0;

    const reader = createReader(async () => {
      attempts += 1;

      if (attempts < 3) {
        throw new Error("temporary reader failure");
      }

      return ["item"];
    });

    const { store, writes } = createStore();

    const pipeline = new IndexingPipeline(reader, store, {
      networkId: "ethereum-mainnet",
      batchSize: 10,
      maxRetries: 2,
    });

    await expect(pipeline.backfill("100", "110")).resolves.toEqual({
      batchesProcessed: 1,
      itemsProcessed: 1,
      finalCursor: "110",
    });

    expect(attempts).toBe(3);
    expect(writes).toEqual([["item"]]);
  });

  it("fails after exhausting reader retries", async () => {
    let attempts = 0;

    const reader = createReader(async () => {
      attempts += 1;
      throw new Error("reader unavailable");
    });

    const { store, writes, checkpoints } = createStore();

    const pipeline = new IndexingPipeline(reader, store, {
      networkId: "ethereum-mainnet",
      batchSize: 10,
      maxRetries: 2,
    });

    await expect(pipeline.backfill("100", "110")).rejects.toThrow("Indexing batch read failed");

    expect(attempts).toBe(3);
    expect(writes).toEqual([]);
    expect(checkpoints).toEqual([]);
  });

  it("does not retry when maxRetries is zero", async () => {
    let attempts = 0;

    const reader = createReader(async () => {
      attempts += 1;
      throw new Error("reader unavailable");
    });

    const { store } = createStore();

    const pipeline = new IndexingPipeline(reader, store, {
      networkId: "ethereum-mainnet",
      batchSize: 10,
      maxRetries: 0,
    });

    await expect(pipeline.backfill("100", "110")).rejects.toThrow("Indexing batch read failed");

    expect(attempts).toBe(1);
  });

  it("rejects invalid pipeline options", () => {
    const reader = createReader(async () => []);
    const { store } = createStore();

    expect(
      () =>
        new IndexingPipeline(reader, store, {
          networkId: "ethereum-mainnet",
          batchSize: 0,
          maxRetries: 0,
        }),
    ).toThrow("Indexing batch size must be a positive integer");

    expect(
      () =>
        new IndexingPipeline(reader, store, {
          networkId: "ethereum-mainnet",
          batchSize: 10,
          maxRetries: -1,
        }),
    ).toThrow("Indexing max retries must be a non-negative integer");

    expect(
      () =>
        new IndexingPipeline(reader, store, {
          networkId: "",
          batchSize: 10,
          maxRetries: 0,
        }),
    ).toThrow("Indexing network id is required");
  });

  it("rejects invalid cursors", async () => {
    const reader = createReader(async () => []);
    const { store } = createStore();

    const pipeline = new IndexingPipeline(reader, store, {
      networkId: "ethereum-mainnet",
      batchSize: 10,
      maxRetries: 0,
    });

    await expect(pipeline.backfill("", "100")).rejects.toThrow("Indexing start cursor is required");

    await expect(pipeline.backfill("100", "")).rejects.toThrow("Indexing end cursor is required");

    await expect(pipeline.backfill("100", "100")).rejects.toThrow(
      "Indexing start cursor must be before end cursor",
    );
  });

  it("rejects cursors that cannot be represented safely", async () => {
    const reader = createReader(async () => []);
    const { store } = createStore();

    const pipeline = new IndexingPipeline(reader, store, {
      networkId: "ethereum-mainnet",
      batchSize: 10,
      maxRetries: 0,
    });

    await expect(pipeline.backfill("not-a-number", "100")).rejects.toThrow(
      "Indexing cursors must be safe non-negative integer values",
    );
  });
  it("resumes backfill from the stored checkpoint", async () => {
    const calls: Array<[string, string]> = [];

    const reader: BlockchainDataReader<string> = {
      async read(from, to) {
        calls.push([from, to]);

        return {
          items: [`${from}-${to}`],
          checkpoint: {
            networkId: "testnet",
            cursor: to,
            blockHeight: Number(to),
            blockHash: `hash-${to}`,
          },
        };
      },
    };

    const store: BlockchainDataStore<string> = {
      async write() {},

      async getCheckpoint() {
        return {
          networkId: "testnet",
          cursor: "40",
          blockHeight: 40,
          blockHash: "hash-40",
        };
      },

      async saveCheckpoint() {},
    };

    const pipeline = new IndexingPipeline(reader, store, {
      networkId: "testnet",
      batchSize: 20,
      maxRetries: 0,
    });

    const result = await pipeline.backfill("0", "100");

    expect(calls).toEqual([
      ["40", "60"],
      ["60", "80"],
      ["80", "100"],
    ]);

    expect(result).toEqual({
      batchesProcessed: 3,
      itemsProcessed: 3,
      finalCursor: "100",
    });
  });
  it("rejects a checkpoint from another network", async () => {
    const reader: BlockchainDataReader<string> = {
      async read(_from, to) {
        return {
          items: ["item"],
          checkpoint: {
            networkId: "testnet",
            cursor: to,
            blockHeight: Number(to),
            blockHash: `hash-${to}`,
          },
        };
      },
    };

    const store: BlockchainDataStore<string> = {
      async write() {},

      async getCheckpoint() {
        return {
          networkId: "ethereum-mainnet",
          cursor: "40",
          blockHeight: 40,
          blockHash: "hash-40",
        };
      },

      async saveCheckpoint() {},
    };

    const pipeline = new IndexingPipeline(reader, store, {
      networkId: "testnet",
      batchSize: 20,
      maxRetries: 0,
    });

    await expect(pipeline.backfill("0", "100")).rejects.toThrow(
      "Indexing checkpoint network mismatch",
    );
  });
  it("persists the checkpoint returned by the reader", async () => {
    const saved: IndexingCheckpoint[] = [];

    const reader: BlockchainDataReader<string> = {
      async read(_from, to) {
        return {
          items: ["item"],
          checkpoint: {
            networkId: "testnet",
            cursor: to,
            blockHeight: 12345,
            blockHash: "real-block-hash",
          },
        };
      },
    };

    const store: BlockchainDataStore<string> = {
      async write() {},

      async getCheckpoint() {
        return undefined;
      },

      async saveCheckpoint(checkpoint) {
        saved.push(checkpoint);
      },
    };

    const pipeline = new IndexingPipeline(reader, store, {
      networkId: "testnet",
      batchSize: 100,
      maxRetries: 0,
    });

    await pipeline.backfill("0", "100");

    expect(saved).toEqual([
      {
        networkId: "testnet",
        cursor: "100",
        blockHeight: 12345,
        blockHash: "real-block-hash",
      },
    ]);
  });
});
