import type { SecretBytes } from "./wallet-crypto-types.js";

export class ManagedSecretBytes implements SecretBytes {
  private readonly buffer: Uint8Array;

  private wiped = false;

  constructor(bytes: Uint8Array) {
    this.buffer = new Uint8Array(bytes);
  }

  copy(): Uint8Array {
    if (this.wiped) {
      throw new Error("Secret bytes have been wiped");
    }

    return new Uint8Array(this.buffer);
  }

  wipe(): void {
    this.buffer.fill(0);
    this.wiped = true;
  }

  get isWiped(): boolean {
    return this.wiped;
  }
}