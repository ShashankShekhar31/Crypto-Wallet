export interface SolanaFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export type SolanaFetch = (
  input: string,
  init?: {
    readonly method?: string;
    readonly headers?: Record<string, string>;
    readonly body?: string;
  },
) => Promise<SolanaFetchResponse>;

export interface SolanaJsonRpcHttpTransportOptions {
  readonly fetch?: SolanaFetch;
}

interface SolanaJsonRpcRequest {
  readonly jsonrpc: "2.0";
  readonly id: number;
  readonly method: string;
  readonly params: readonly unknown[];
}

interface SolanaJsonRpcResponse<TResponse> {
  readonly jsonrpc: string;
  readonly id: number;
  readonly result?: TResponse;
  readonly error?: {
    readonly code: number;
    readonly message: string;
    readonly data?: unknown;
  };
}

const DEFAULT_HEADERS = Object.freeze({
  "content-type": "application/json",
});

const defaultFetch: SolanaFetch = async (input, init) => {
  const fetchFn = (
    globalThis as unknown as {
      fetch?: SolanaFetch;
    }
  ).fetch;

  if (!fetchFn) {
    throw new Error("Fetch API is not available");
  }

  const response = await fetchFn(input, init);

  return {
    ok: response.ok,
    status: response.status,
    json: () => response.json(),
  };
};

export class SolanaJsonRpcHttpTransport {
  private readonly fetch: SolanaFetch;

  private requestId = 0;

  constructor(
    options: SolanaJsonRpcHttpTransportOptions = {},
  ) {
    this.fetch = options.fetch ?? defaultFetch;
  }

  async request<TResponse>(
    url: string,
    method: string,
    params: readonly unknown[] = [],
  ): Promise<TResponse> {
    const normalizedUrl = url.trim();
    const normalizedMethod = method.trim();

    if (!normalizedUrl) {
      throw new Error("Solana RPC URL is required");
    }

    if (!normalizedMethod) {
      throw new Error("Solana RPC method is required");
    }

    const request: SolanaJsonRpcRequest = {
      jsonrpc: "2.0",
      id: ++this.requestId,
      method: normalizedMethod,
      params: [...params],
    };

    let response: SolanaFetchResponse;

    try {
      response = await this.fetch(normalizedUrl, {
        method: "POST",
        headers: DEFAULT_HEADERS,
        body: JSON.stringify(request),
      });
    } catch (error) {
      throw new Error("Solana RPC request failed", {
        cause: error,
      });
    }

    if (!response.ok) {
      throw new Error(
        `Solana RPC HTTP request failed with status ${response.status}`,
      );
    }

    let payload: SolanaJsonRpcResponse<TResponse>;

    try {
      payload =
        (await response.json()) as SolanaJsonRpcResponse<TResponse>;
    } catch (error) {
      throw new Error("Invalid Solana RPC JSON response", {
        cause: error,
      });
    }

    if (
      typeof payload !== "object" ||
      payload === null ||
      payload.jsonrpc !== "2.0"
    ) {
      throw new Error("Invalid Solana RPC response");
    }

    if (payload.error !== undefined) {
      throw new Error(
        `Solana RPC error ${payload.error.code}: ${payload.error.message}`,
      );
    }

    if (!("result" in payload)) {
      throw new Error("Solana RPC response has no result");
    }

    return payload.result as TResponse;
  }
}