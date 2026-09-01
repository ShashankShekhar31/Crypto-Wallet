export interface EvmRpcTransport {
  request<TResponse>(url: string, method: string, params?: readonly unknown[]): Promise<TResponse>;
}

export interface EvmRpcProviderOptions {
  readonly transport: EvmRpcTransport;
}

export interface EvmRpcProvider {
  readonly networkId: string;

  request<TResponse>(method: string, params?: readonly unknown[]): Promise<TResponse>;
}
