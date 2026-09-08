import type { SupportedChain } from "@crypto-wallet/shared-types";

import { normalizeDAppOrigin, type DAppOrigin } from "./origin.js";

export type DAppRequestType = "connect" | "sign" | "transaction";

export interface DAppRequestBase {
  readonly id: string;
  readonly origin: DAppOrigin;
  readonly accountId: string;
  readonly chain: SupportedChain;
  readonly createdAt: string;
}

export interface DAppConnectRequest extends DAppRequestBase {
  readonly type: "connect";
}

export interface DAppSignRequest extends DAppRequestBase {
  readonly type: "sign";
  readonly message: string;
}

export interface DAppTransactionRequest extends DAppRequestBase {
  readonly type: "transaction";
  readonly transaction: DAppTransaction;
}

export interface DAppTransaction {
  readonly to: string;
  readonly value: string;
  readonly data?: string;
}

export type DAppRequest = DAppConnectRequest | DAppSignRequest | DAppTransactionRequest;

export interface CreateDAppRequestBase {
  readonly id: string;
  readonly origin: string;
  readonly accountId: string;
  readonly chain: SupportedChain;
  readonly createdAt?: string;
}

export interface CreateDAppConnectRequestInput extends CreateDAppRequestBase {
  readonly type: "connect";
}

export interface CreateDAppSignRequestInput extends CreateDAppRequestBase {
  readonly type: "sign";
  readonly message: string;
}

export interface CreateDAppTransactionRequestInput extends CreateDAppRequestBase {
  readonly type: "transaction";
  readonly transaction: DAppTransaction;
}

export type CreateDAppRequestInput =
  CreateDAppConnectRequestInput | CreateDAppSignRequestInput | CreateDAppTransactionRequestInput;

function validateBaseRequest(input: CreateDAppRequestBase): void {
  if (input.id.trim().length === 0) {
    throw new Error("Request ID is required");
  }

  if (input.accountId.trim().length === 0) {
    throw new Error("Account ID is required");
  }

  normalizeDAppOrigin(input.origin);
}

function normalizeCreatedAt(createdAt: string | undefined): string {
  return createdAt ?? new Date().toISOString();
}

function validateTransaction(transaction: DAppTransaction): void {
  if (transaction.to.trim().length === 0) {
    throw new Error("Transaction recipient is required");
  }

  if (transaction.value.trim().length === 0) {
    throw new Error("Transaction value is required");
  }

  if (transaction.data !== undefined && transaction.data.trim().length === 0) {
    throw new Error("Transaction data cannot be empty");
  }
}

export function createDAppRequest(input: CreateDAppRequestInput): DAppRequest {
  validateBaseRequest(input);

  const base = {
    id: input.id,
    origin: normalizeDAppOrigin(input.origin),
    accountId: input.accountId,
    chain: input.chain,
    createdAt: normalizeCreatedAt(input.createdAt),
  };

  switch (input.type) {
    case "connect":
      return {
        ...base,
        type: "connect",
      };

    case "sign":
      if (input.message.length === 0) {
        throw new Error("Sign message is required");
      }

      return {
        ...base,
        type: "sign",
        message: input.message,
      };

    case "transaction":
      validateTransaction(input.transaction);

      return {
        ...base,
        type: "transaction",
        transaction: input.transaction,
      };

    default: {
      const exhaustiveCheck: never = input;
      return exhaustiveCheck;
    }
  }
}
