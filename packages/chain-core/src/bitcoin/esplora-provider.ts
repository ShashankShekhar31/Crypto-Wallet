import { validateBitcoinAddress } from "./address.js";

import type {
  BitcoinFeeEstimate,
  BitcoinProvider,
  BitcoinTransactionStatus,
  BitcoinUtxo,
} from "./provider.js";

import type { BitcoinNetworkId } from "./types.js";

import type { BitcoinTransactionOutput, BitcoinTransactionReader } from "./transaction-output.js";

interface EsploraUtxoResponse {
  readonly txid: string;
  readonly vout: number;
  readonly value: number;
  readonly status: {
    readonly confirmed: boolean;
    readonly block_height?: number;
  };
}

interface EsploraFeeResponse {
  readonly [target: string]: number;
}

interface EsploraTransactionOutputResponse {
  readonly value: number;
  readonly scriptpubkey: string;
}

interface EsploraTransactionResponse {
  readonly vout: readonly EsploraTransactionOutputResponse[];
}

interface BitcoinHttpResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
  text?(): Promise<string>;
}

interface BitcoinHttpRequestInit {
  readonly method?: string;
  readonly body?: string;
}

interface EsploraTransactionStatusResponse {
  readonly confirmed: boolean;
  readonly block_height?: number;
  readonly block_hash?: string;
}

type BitcoinHttpFetcher = (
  input: string,
  init?: BitcoinHttpRequestInit,
) => Promise<BitcoinHttpResponse>;

function getBaseUrl(network: BitcoinNetworkId): string {
  if (network === "bitcoin-mainnet") {
    return "https://blockstream.info/api";
  }

  return "https://blockstream.info/testnet/api";
}

function validateHttpResponse(response: BitcoinHttpResponse): void {
  if (!response.ok) {
    throw new Error(`Bitcoin Esplora request failed with HTTP ${response.status}`);
  }
}

function createDefaultFetcher(): BitcoinHttpFetcher {
  const fetcher = (
    globalThis as typeof globalThis & {
      fetch?: BitcoinHttpFetcher;
    }
  ).fetch;

  if (!fetcher) {
    throw new Error("Global fetch is unavailable");
  }

  return fetcher;
}

function decodeHex(value: string): Uint8Array {
  const normalized = value.trim();

  if (normalized.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(normalized)) {
    throw new Error("Invalid Bitcoin scriptPubKey hex");
  }

  const bytes = new Uint8Array(normalized.length / 2);

  for (let index = 0; index < normalized.length; index += 2) {
    bytes[index / 2] = Number.parseInt(normalized.slice(index, index + 2), 16);
  }

  return bytes;
}

function normalizeTransactionId(value: string): string {
  const normalized = value.trim();

  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("Invalid Bitcoin transaction ID");
  }

  return normalized.toLowerCase();
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export class EsploraBitcoinProvider implements BitcoinProvider, BitcoinTransactionReader {
  readonly network: BitcoinNetworkId;

  private readonly baseUrl: string;
  private readonly fetcher: BitcoinHttpFetcher;

  constructor(network: BitcoinNetworkId, fetcher: BitcoinHttpFetcher = createDefaultFetcher()) {
    this.network = network;
    this.baseUrl = getBaseUrl(network);
    this.fetcher = fetcher;
  }

  async getUtxos(address: string): Promise<readonly BitcoinUtxo[]> {
    const validatedAddress = validateBitcoinAddress(address, this.network);

    const response = await this.fetcher(
      `${this.baseUrl}/address/${encodeURIComponent(validatedAddress)}/utxo`,
    );

    validateHttpResponse(response);

    const data = (await response.json()) as EsploraUtxoResponse[];

    const utxos = await Promise.all(
      data.map(async (utxo) => {
        const previousOutput = await this.getTransactionOutput(utxo.txid, utxo.vout);

        return Object.freeze({
          txid: utxo.txid,
          vout: utxo.vout,
          value: previousOutput.value,
          scriptPubKey: new Uint8Array(previousOutput.scriptPubKey),
          confirmations: utxo.status.confirmed ? 1 : 0,
        });
      }),
    );

    return Object.freeze(utxos);
  }

  async getTransactionOutput(txid: string, vout: number): Promise<BitcoinTransactionOutput> {
    if (!Number.isInteger(vout) || vout < 0) {
      throw new Error("Bitcoin transaction output index must be a non-negative integer");
    }

    const normalizedTxid = txid.trim();

    if (normalizedTxid.length !== 64 || !/^[0-9a-fA-F]+$/.test(normalizedTxid)) {
      throw new Error("Invalid Bitcoin transaction id");
    }

    const response = await this.fetcher(`${this.baseUrl}/tx/${normalizedTxid}`);

    validateHttpResponse(response);

    const data = (await response.json()) as EsploraTransactionResponse;

    const output = data.vout[vout];

    if (output === undefined) {
      throw new Error(`Bitcoin transaction output ${vout} does not exist`);
    }

    if (!Number.isSafeInteger(output.value) || output.value < 0) {
      throw new Error("Invalid Bitcoin transaction output value");
    }

    const scriptPubKey = decodeHex(output.scriptpubkey);

    return Object.freeze({
      value: BigInt(output.value),
      scriptPubKey,
    });
  }

  async estimateFee(): Promise<BitcoinFeeEstimate> {
    const response = await this.fetcher(`${this.baseUrl}/fee-estimates`);

    validateHttpResponse(response);

    const data = (await response.json()) as EsploraFeeResponse;

    const fee = data["6"] ?? data["3"] ?? data["1"];

    if (fee === undefined || !Number.isFinite(fee) || fee <= 0) {
      throw new Error("Bitcoin fee estimate is unavailable");
    }

    return Object.freeze({
      satoshisPerVbyte: fee,
    });
  }

  async broadcastTransaction(rawTransaction: Uint8Array): Promise<string> {
    if (rawTransaction.byteLength === 0) {
      throw new Error("Raw transaction is required");
    }

    const response = await this.fetcher(`${this.baseUrl}/tx`, {
      method: "POST",
      body: bytesToHex(rawTransaction),
    });

    if (!response.ok) {
      throw new Error(`Bitcoin transaction broadcast failed: ${response.status}`);
    }

    if (!response.text) {
      throw new Error("Bitcoin transaction broadcast response has no text body");
    }

    const transactionId = await response.text();

    return normalizeTransactionId(transactionId);
  }

  async getTransactionStatus(txid: string): Promise<BitcoinTransactionStatus> {
    const normalizedTxid = normalizeTransactionId(txid);

    const response = await this.fetcher(`${this.baseUrl}/tx/${normalizedTxid}/status`);

    validateHttpResponse(response);

    const data = (await response.json()) as EsploraTransactionStatusResponse;

    if (typeof data.confirmed !== "boolean") {
      throw new Error("Invalid Bitcoin transaction status response");
    }

    if (!data.confirmed) {
      return Object.freeze({
        txid: normalizedTxid,
        confirmed: false,
        confirmations: 0,
      });
    }

    if (
      typeof data.block_height !== "number" ||
      !Number.isSafeInteger(data.block_height) ||
      data.block_height < 0
    ) {
      throw new Error("Invalid Bitcoin transaction block height");
    }

    if (typeof data.block_hash !== "string" || !/^[0-9a-fA-F]{64}$/.test(data.block_hash)) {
      throw new Error("Invalid Bitcoin transaction block hash");
    }

    const blockHeight = data.block_height;
    const blockHash = data.block_hash;

    const tipResponse = await this.fetcher(`${this.baseUrl}/blocks/tip/height`);

    validateHttpResponse(tipResponse);

    if (!tipResponse.text) {
      throw new Error("Bitcoin tip-height response has no text body");
    }

    const tipHeightText = (await tipResponse.text()).trim();
    const tipHeight = Number(tipHeightText);

    if (!Number.isSafeInteger(tipHeight) || tipHeight < 0) {
      throw new Error("Invalid Bitcoin tip height");
    }

    if (tipHeight < blockHeight) {
      throw new Error("Bitcoin transaction block is ahead of chain tip");
    }

    const confirmations = tipHeight - blockHeight + 1;

    return Object.freeze({
      txid: normalizedTxid,
      confirmed: true,
      confirmations,
      blockHeight,
      blockHash: blockHash.toLowerCase(),
    });
  }
}
