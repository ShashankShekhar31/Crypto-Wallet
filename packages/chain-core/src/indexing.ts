export type IndexingCursor = string;

export interface IndexedBlock {
  readonly height: number;
  readonly hash: string;
  readonly parentHash?: string;
}

export interface IndexingCheckpoint {
  readonly networkId: string;
  readonly cursor: IndexingCursor;
  readonly blockHeight: number;
  readonly blockHash: string;
}

export interface BlockchainDataBatch<TData> {
  readonly items: readonly TData[];
  readonly checkpoint: IndexingCheckpoint;
}

export interface BlockchainDataReader<TData> {
  read(
    from: IndexingCursor,
    to: IndexingCursor,
  ): Promise<BlockchainDataBatch<TData>>;
}

export interface BlockchainDataStore<TData> {
  write(items: readonly TData[]): Promise<void>;

  getCheckpoint(): Promise<IndexingCheckpoint | undefined>;

  saveCheckpoint(checkpoint: IndexingCheckpoint): Promise<void>;
}