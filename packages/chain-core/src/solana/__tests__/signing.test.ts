import {
  describe,
  expect,
  it,
} from "vitest";

import {
  signSolanaMessage,
} from "../signing.js";

import type {
  SolanaTransactionSigner,
} from "../signing.js";

const MESSAGE =
  new Uint8Array([
    1,
    2,
    3,
    4,
  ]);

function createSigner(
  signature = new Uint8Array(64),
): SolanaTransactionSigner {
  return {
    sign: async () =>
      new Uint8Array(signature),
  };
}

describe(
  "signSolanaMessage",
  () => {
    it(
      "signs a serialized message",
      async () => {
        const signature =
          new Uint8Array(64);

        signature[0] = 42;

        const signer =
          createSigner(signature);

        const result =
          await signSolanaMessage(
            signer,
            MESSAGE,
          );

        expect(result).toEqual(
          signature,
        );
      },
    );

    it(
      "passes a copy of the message to the signer",
      async () => {
        let received:
          Uint8Array | undefined;

        const signer:
          SolanaTransactionSigner = {
            sign: async (message) => {
              received = message;

              return new Uint8Array(64);
            },
          };

        await signSolanaMessage(
          signer,
          MESSAGE,
        );

        expect(received).toEqual(
          MESSAGE,
        );

        expect(received).not.toBe(
          MESSAGE,
        );
      },
    );

    it(
      "does not mutate the input message",
      async () => {
        const original = [
          ...MESSAGE,
        ];

        const signer:
          SolanaTransactionSigner = {
            sign: async (message) => {
              message[0] = 255;

              return new Uint8Array(64);
            },
          };

        await signSolanaMessage(
          signer,
          MESSAGE,
        );

        expect([
          ...MESSAGE,
        ]).toEqual(original);
      },
    );

    it(
      "rejects a non-Uint8Array signature",
      async () => {
        const signer:
          SolanaTransactionSigner = {
            sign: async () =>
              "invalid" as never,
          };

        await expect(
          signSolanaMessage(
            signer,
            MESSAGE,
          ),
        ).rejects.toThrow(
          "Invalid Solana transaction signature",
        );
      },
    );

    it(
      "rejects a short signature",
      async () => {
        const signer =
          createSigner(
            new Uint8Array(63),
          );

        await expect(
          signSolanaMessage(
            signer,
            MESSAGE,
          ),
        ).rejects.toThrow(
          "Solana transaction signature must be 64 bytes",
        );
      },
    );

    it(
      "rejects a long signature",
      async () => {
        const signer =
          createSigner(
            new Uint8Array(65),
          );

        await expect(
          signSolanaMessage(
            signer,
            MESSAGE,
          ),
        ).rejects.toThrow(
          "Solana transaction signature must be 64 bytes",
        );
      },
    );

    it(
      "propagates signer errors",
      async () => {
        const signer:
          SolanaTransactionSigner = {
            sign: async () => {
              throw new Error(
                "Signing failed",
              );
            },
          };

        await expect(
          signSolanaMessage(
            signer,
            MESSAGE,
          ),
        ).rejects.toThrow(
          "Signing failed",
        );
      },
    );

    it(
      "returns an independent signature copy",
      async () => {
        const signature =
          new Uint8Array(64);

        signature[0] = 10;

        const signer =
          createSigner(signature);

        const result =
          await signSolanaMessage(
            signer,
            MESSAGE,
          );

        result[0] = 99;

        expect(signature[0]).toBe(10);
      },
    );
  },
);