import type {
  CustodySignRequest,
  CustodySignature,
  KeyManagementProvider,
  KeyReference,
} from "./key-management.js";

export type KeyManagementProviderType = "local" | "aws-kms" | "aws-cloudhsm" | "mpc";

export interface KeyManagementProviderMetadata {
  readonly type: KeyManagementProviderType;
  readonly productionReady: boolean;
  readonly managesPrivateKeyMaterial: boolean;
}

export interface ManagedKeyProvider extends KeyManagementProvider {
  readonly metadata: KeyManagementProviderMetadata;

  getPublicKey(key: KeyReference): Promise<Uint8Array>;
  sign(request: CustodySignRequest): Promise<CustodySignature>;
}
