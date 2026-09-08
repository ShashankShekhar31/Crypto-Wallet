import type { HardwareTransport } from "./transport.js";

import { decodeHardwareSignResponse, encodeHardwareSignCommand } from "./command.js";

export type HardwareWalletState = "disconnected" | "connected";

export interface HardwareDeviceInfo {
  readonly vendor: string;
  readonly model: string;
  readonly firmwareVersion: string;
}

export interface HardwarePublicKeyRequest {
  readonly chain: string;
  readonly derivationPath: string;
}

export interface HardwarePublicKey {
  readonly chain: string;
  readonly derivationPath: string;
  readonly publicKey: string;
  readonly address: string;
}

export interface HardwareSignRequest {
  readonly chain: string;
  readonly derivationPath: string;
  readonly payload: Uint8Array;
}

export interface HardwareSignature {
  readonly chain: string;
  readonly signature: Uint8Array;
}

export interface HardwareWallet {
  readonly state: HardwareWalletState;

  readonly transport: HardwareTransport;

  connect(): Promise<void>;

  getDeviceInfo(): Promise<HardwareDeviceInfo>;

  getPublicKey(request: HardwarePublicKeyRequest): Promise<HardwarePublicKey>;

  sign(request: HardwareSignRequest): Promise<HardwareSignature>;

  disconnect(): Promise<void>;
}

export interface MockHardwareWalletOptions {
  readonly deviceInfo: HardwareDeviceInfo;

  readonly publicKeys?: readonly HardwarePublicKey[];
}

export class MockHardwareWallet implements HardwareWallet {
  constructor(
    public readonly transport: HardwareTransport,
    private readonly options: MockHardwareWalletOptions,
  ) {}

  get state(): HardwareWalletState {
    return this.transport.state;
  }

  async connect(): Promise<void> {
    await this.transport.connect();
  }

  async getDeviceInfo(): Promise<HardwareDeviceInfo> {
    this.assertConnected();

    return Object.freeze({
      ...this.options.deviceInfo,
    });
  }

  async getPublicKey(request: HardwarePublicKeyRequest): Promise<HardwarePublicKey> {
    this.assertConnected();

    const match = this.options.publicKeys?.find(
      (entry) => entry.chain === request.chain && entry.derivationPath === request.derivationPath,
    );

    if (match === undefined) {
      throw new Error(
        `Mock hardware public key not found: ${request.chain} ${request.derivationPath}`,
      );
    }

    return Object.freeze({
      ...match,
    });
  }

  async sign(request: HardwareSignRequest): Promise<HardwareSignature> {
    this.assertConnected();

    const command = encodeHardwareSignCommand({
      chain: request.chain,
      derivationPath: request.derivationPath,
      payload: new Uint8Array(request.payload),
    });

    const response = await this.transport.send(command);

    const signature = decodeHardwareSignResponse(response);

    if (signature.chain !== request.chain) {
      throw new Error("Hardware signature chain does not match signing request");
    }

    return Object.freeze({
      chain: signature.chain,
      signature: new Uint8Array(signature.signature),
    });
  }

  async disconnect(): Promise<void> {
    await this.transport.disconnect();
  }

  private assertConnected(): void {
    if (this.transport.state !== "connected") {
      throw new Error("Hardware wallet is not connected");
    }
  }
}
