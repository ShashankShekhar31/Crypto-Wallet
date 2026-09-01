import type { EvmRpcTransport } from "./rpc.js";

export interface EvmHttpResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export type EvmFetch = (
  input: string,
  init?: {
    readonly method?: string;
    readonly headers?: Record<string, string>;
    readonly body?: string;
  },
) => Promise<EvmHttpResponse>;

export interface EvmJsonRpcTransportOptions {
  readonly fetch: EvmFetch;
}

export class EvmJsonRpcHttpTransport implements EvmRpcTransport {
  private readonly fetch: EvmFetch;

  constructor(options: EvmJsonRpcTransportOptions) {
    this.fetch = options.fetch;
  }

  async request<TResponse>(
    url: string,
    method: string,
    params: readonly unknown[] = [],
  ): Promise<TResponse> {
    const response = await this.fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }),
    });

    if (!response.ok) {
      throw new Error(`EVM RPC HTTP request failed with status ${response.status}`);
    }

    const payload = await response.json();

    if (!isJsonRpcResponse(payload)) {
      throw new Error("Invalid EVM JSON-RPC response");
    }

    if (payload.error !== undefined) {
      throw new Error(`EVM RPC error ${payload.error.code}: ${payload.error.message}`);
    }

    return payload.result as TResponse;
  }
}

interface JsonRpcResponse {
  readonly jsonrpc: string;
  readonly id: number;
  readonly result?: unknown;
  readonly error?: {
    readonly code: number;
    readonly message: string;
  };
}

function isJsonRpcResponse(value: unknown): value is JsonRpcResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (candidate.jsonrpc !== "2.0") {
    return false;
  }

  if (typeof candidate.id !== "number") {
    return false;
  }

  if ("error" in candidate) {
    const error = candidate.error;

    if (typeof error !== "object" || error === null) {
      return false;
    }

    const errorRecord = error as Record<string, unknown>;

    return typeof errorRecord.code === "number" && typeof errorRecord.message === "string";
  }

  return "result" in candidate;
}
