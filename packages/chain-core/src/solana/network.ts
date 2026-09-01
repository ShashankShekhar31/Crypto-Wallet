import type { SolanaCommitment, SolanaNetworkConfig } from "./types.js";

const SOLANA_COMMITMENTS: readonly SolanaCommitment[] = ["processed", "confirmed", "finalized"];

function isSolanaCommitment(value: string): value is SolanaCommitment {
  return SOLANA_COMMITMENTS.includes(value as SolanaCommitment);
}

export function createSolanaNetworkConfig(input: {
  id: string;
  name: string;
  rpcUrls: readonly string[];
  commitment?: SolanaCommitment;
  genesisHash?: string;
}): SolanaNetworkConfig {
  const id = input.id.trim();
  const name = input.name.trim();

  if (!id) {
    throw new Error("Solana network id is required");
  }

  if (!name) {
    throw new Error("Solana network name is required");
  }

  if (input.rpcUrls.length === 0) {
    throw new Error("Solana network has no RPC URL");
  }

  const rpcUrls = input.rpcUrls.map((url) => {
    const normalized = url.trim();

    if (!normalized) {
      throw new Error("Solana RPC URL is required");
    }

    if (!/^https?:\/\/[^\s]+$/i.test(normalized)) {
      throw new Error("Invalid Solana RPC URL");
    }

    return normalized;
  });

  const genesisHash = input.genesisHash?.trim() ?? "";

  if (!genesisHash) {
    throw new Error("Solana genesis hash is required");
  }

  const commitment = input.commitment ?? "confirmed";

  if (!isSolanaCommitment(commitment)) {
    throw new Error("Invalid Solana commitment");
  }

  return Object.freeze({
    id,
    name,
    rpcUrls: Object.freeze([...rpcUrls]),
    commitment,
    genesisHash,
  });
}
