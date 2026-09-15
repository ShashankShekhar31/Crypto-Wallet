export type CustodyTier = "hot" | "warm" | "cold";

export interface KeyReference {
  readonly id: string;
  readonly tier: CustodyTier;
}

export interface CustodySignRequest {
  readonly key: KeyReference;
  readonly chain: string;
  readonly payload: Uint8Array;
  readonly correlationId: string;
}

export interface CustodySignature {
  readonly keyId: string;
  readonly chain: string;
  readonly signature: Uint8Array;
}

export interface KeyManagementProvider {
  getPublicKey(key: KeyReference): Promise<Uint8Array>;

  sign(request: CustodySignRequest): Promise<CustodySignature>;
}
