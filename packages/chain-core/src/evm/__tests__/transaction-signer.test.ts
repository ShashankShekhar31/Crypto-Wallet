import { describe, expect, it } from "vitest";

import type {
  DerivedKey,
  WalletSigner,
} from "@crypto-wallet/crypto";

import {
  DefaultEvmTransactionSigner,
} from "../transaction-signer.js";

import {
  createEvmUnsignedTransaction,
} from "../transaction.js";

import {
  createEip1559SigningDigest,
} from "../transaction-signing.js";

import type {
  EvmNetworkConfig,
} from "../types.js";

describe("DefaultEvmTransactionSigner", () => {
  const network: EvmNetworkConfig = {
    id: "ethereum-mainnet",
    name: "Ethereum",
    chainId: 1n,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: [
      "https://rpc.example.com",
    ],
  };

  const to =
    "0x0000000000000000000000000000000000000002";

  const transaction =
    createEvmUnsignedTransaction(network, {
      to,
      nonce: 7n,
      gasLimit: 21000n,
      maxFeePerGas: 30_000_000_000n,
      maxPriorityFeePerGas: 2_000_000_000n,
    });

  const key = {} as DerivedKey;

  it("signs the EIP-1559 transaction digest", async () => {
    let receivedDigest: Uint8Array | undefined;

    const walletSigner: WalletSigner = {
      signDigest(
        _key,
        digest,
      ) {
        receivedDigest =
          new Uint8Array(digest);

        return {
          compact: new Uint8Array(64).fill(0x11),
          recovery: 1,
        };
      },
    };

    const signer =
      new DefaultEvmTransactionSigner(
        walletSigner,
      );

    const signature =
      await signer.signTransaction(
        transaction,
        key,
      );

    expect(signature.compact)
      .toHaveLength(64);

    expect(signature.recovery)
      .toBe(1);

    expect(receivedDigest)
      .toEqual(
        createEip1559SigningDigest(
          transaction,
        ),
      );
  });

  it("passes the same derived key to the wallet signer", async () => {
    let receivedKey: DerivedKey | undefined;

    const walletSigner: WalletSigner = {
      signDigest(
        signingKey,
        _digest,
      ) {
        receivedKey = signingKey;

        return {
          compact: new Uint8Array(64),
          recovery: 0,
        };
      },
    };

    const signer =
      new DefaultEvmTransactionSigner(
        walletSigner,
      );

    await signer.signTransaction(
      transaction,
      key,
    );

    expect(receivedKey).toBe(key);
  });

  it("returns a defensive copy of the signature", async () => {
    const compact =
      new Uint8Array(64).fill(0x22);

    const walletSigner: WalletSigner = {
      signDigest() {
        return {
          compact,
          recovery: 0,
        };
      },
    };

    const signer =
      new DefaultEvmTransactionSigner(
        walletSigner,
      );

    const signature =
      await signer.signTransaction(
        transaction,
        key,
      );

    compact.fill(0);

    expect(signature.compact[0])
      .toBe(0x22);
  });

  it("preserves the recovery identifier", async () => {
    const walletSigner: WalletSigner = {
      signDigest() {
        return {
          compact: new Uint8Array(64),
          recovery: 3,
        };
      },
    };

    const signer =
      new DefaultEvmTransactionSigner(
        walletSigner,
      );

    const signature =
      await signer.signTransaction(
        transaction,
        key,
      );

    expect(signature.recovery)
      .toBe(3);
  });

  it("returns an immutable signature", async () => {
    const walletSigner: WalletSigner = {
      signDigest() {
        return {
          compact: new Uint8Array(64),
          recovery: 0,
        };
      },
    };

    const signer =
      new DefaultEvmTransactionSigner(
        walletSigner,
      );

    const signature =
      await signer.signTransaction(
        transaction,
        key,
      );

    expect(
      Object.isFrozen(signature),
    ).toBe(true);
  });
});