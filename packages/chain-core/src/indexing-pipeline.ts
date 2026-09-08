import type {
  BlockchainDataBatch,
  BlockchainDataReader,
  BlockchainDataStore,
  IndexingCheckpoint,
  IndexingCursor,
} from "./indexing.js";

export interface IndexingPipelineOptions {
  readonly networkId: string;
  readonly batchSize: number;
  readonly maxRetries: number;
}

export interface IndexingPipelineResult {
  readonly batchesProcessed: number;
  readonly itemsProcessed: number;
  readonly finalCursor: IndexingCursor;
}

export class IndexingPipeline<TData> {
  private readonly networkId: string;
  private readonly batchSize: number;
  private readonly maxRetries: number;

  constructor(
    private readonly reader: BlockchainDataReader<TData>,
    private readonly store: BlockchainDataStore<TData>,
    options: IndexingPipelineOptions,
  ) {
    if (!options.networkId.trim()) {
      throw new Error("Indexing network id is required");
    }

    if (!Number.isInteger(options.batchSize) || options.batchSize <= 0) {
      throw new Error("Indexing batch size must be a positive integer");
    }

    if (!Number.isInteger(options.maxRetries) || options.maxRetries < 0) {
      throw new Error("Indexing max retries must be a non-negative integer");
    }

    this.networkId = options.networkId.trim();
    this.batchSize = options.batchSize;
    this.maxRetries = options.maxRetries;
  }

  async backfill(
    startCursor: IndexingCursor,
    endCursor: IndexingCursor,
  ): Promise<IndexingPipelineResult> {
    const normalizedStart = startCursor.trim();
    const normalizedEnd = endCursor.trim();

    if (!normalizedStart) {
      throw new Error("Indexing start cursor is required");
    }

    if (!normalizedEnd) {
      throw new Error("Indexing end cursor is required");
    }

    this.validateCursorRange(normalizedStart, normalizedEnd);

    const checkpoint = await this.store.getCheckpoint();
    let currentCursor = this.resolveResumeCursor(normalizedStart, normalizedEnd, checkpoint);

    let batchesProcessed = 0;
    let itemsProcessed = 0;

    while (currentCursor !== normalizedEnd) {
      const nextCursor = this.advanceCursor(currentCursor, normalizedEnd);

      const batch = await this.readWithRetry(currentCursor, nextCursor);

      this.validateBatch(batch, nextCursor);

      await this.store.write(batch.items);
      await this.store.saveCheckpoint(batch.checkpoint);

      batchesProcessed += 1;
      itemsProcessed += batch.items.length;
      currentCursor = nextCursor;
    }

    return {
      batchesProcessed,
      itemsProcessed,
      finalCursor: currentCursor,
    };
  }

  private async readWithRetry(
    from: IndexingCursor,
    to: IndexingCursor,
  ): Promise<BlockchainDataBatch<TData>> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        return await this.reader.read(from, to);
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error("Indexing batch read failed", {
      cause: lastError,
    });
  }

  private validateBatch(batch: BlockchainDataBatch<TData>, expectedCursor: IndexingCursor): void {
    if (!batch || typeof batch !== "object") {
      throw new Error("Indexing reader returned an invalid batch");
    }

    if (!batch.checkpoint || typeof batch.checkpoint !== "object") {
      throw new Error("Indexing reader returned an invalid checkpoint");
    }

    if (batch.checkpoint.networkId !== this.networkId) {
      throw new Error("Indexing checkpoint network mismatch");
    }

    if (batch.checkpoint.cursor !== expectedCursor) {
      throw new Error(
        `Indexing checkpoint cursor mismatch: expected ${expectedCursor}, received ${batch.checkpoint.cursor}`,
      );
    }

    if (!Number.isSafeInteger(batch.checkpoint.blockHeight) || batch.checkpoint.blockHeight < 0) {
      throw new Error("Indexing checkpoint block height must be a safe integer");
    }

    if (!batch.checkpoint.blockHash.trim()) {
      throw new Error("Indexing checkpoint block hash is required");
    }
  }

  private resolveResumeCursor(
    start: IndexingCursor,
    end: IndexingCursor,
    checkpoint: IndexingCheckpoint | undefined,
  ): IndexingCursor {
    if (!checkpoint) {
      return start;
    }

    if (checkpoint.networkId !== this.networkId) {
      throw new Error("Indexing checkpoint network mismatch");
    }

    const checkpointNumber = this.parseCursor(checkpoint.cursor);
    const startNumber = this.parseCursor(start);
    const endNumber = this.parseCursor(end);

    if (checkpointNumber <= startNumber) {
      return start;
    }

    if (checkpointNumber >= endNumber) {
      return end;
    }

    return checkpoint.cursor;
  }

  private validateCursorRange(start: IndexingCursor, end: IndexingCursor): void {
    const startNumber = this.parseCursor(start);
    const endNumber = this.parseCursor(end);

    if (startNumber >= endNumber) {
      throw new Error("Indexing start cursor must be before end cursor");
    }
  }

  private advanceCursor(current: IndexingCursor, end: IndexingCursor): IndexingCursor {
    const currentNumber = this.parseCursor(current);
    const endNumber = this.parseCursor(end);

    const next = Math.min(currentNumber + this.batchSize, endNumber);

    return String(next);
  }

  private parseCursor(cursor: IndexingCursor): number {
    const value = Number(cursor);

    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error("Indexing cursors must be safe non-negative integer values");
    }

    return value;
  }
}
