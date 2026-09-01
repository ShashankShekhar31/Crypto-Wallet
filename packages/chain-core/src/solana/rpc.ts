export interface SolanaRpcTransport {
  request<TResponse>(
    url: string,
    method: string,
    params?: readonly unknown[],
  ): Promise<TResponse>;
}

export interface SolanaRpcProviderOptions {
  readonly transport: SolanaRpcTransport;
}

export interface SolanaRpcProvider {
  readonly networkId: string;

  request<TResponse>(
    method: string,
    params?: readonly unknown[],
  ): Promise<TResponse>;
}