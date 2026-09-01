export interface SolanaTransactionSigner {
  sign(message: Uint8Array): Promise<Uint8Array>;
}

export interface SolanaSignature {
  readonly publicKey: string;
  readonly signature: Uint8Array;
}

export async function signSolanaMessage(
  signer: SolanaTransactionSigner,
  message: Uint8Array,
): Promise<Uint8Array> {
  const messageCopy = new Uint8Array(message);

  const signature = await signer.sign(messageCopy);

  if (!(signature instanceof Uint8Array)) {
    throw new Error("Invalid Solana transaction signature");
  }

  if (signature.length !== 64) {
    throw new Error("Solana transaction signature must be 64 bytes");
  }

  return new Uint8Array(signature);
}
