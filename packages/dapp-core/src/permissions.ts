import type { SupportedChain } from "@crypto-wallet/shared-types";

import { normalizeDAppOrigin, type DAppOrigin } from "./origin.js";

export type DAppCapability = "connect" | "sign" | "transact";

export interface DAppPermission {
  readonly origin: DAppOrigin;
  readonly accountId: string;
  readonly chain: SupportedChain;
  readonly capabilities: readonly DAppCapability[];
  readonly grantedAt: string;
}

export interface CreateDAppPermissionInput {
  readonly origin: string;
  readonly accountId: string;
  readonly chain: SupportedChain;
  readonly capabilities: readonly DAppCapability[];
  readonly grantedAt?: string;
}

const CAPABILITIES: readonly DAppCapability[] = ["connect", "sign", "transact"];

function isDAppCapability(value: string): value is DAppCapability {
  return CAPABILITIES.includes(value as DAppCapability);
}

function normalizeCapabilities(capabilities: readonly DAppCapability[]): readonly DAppCapability[] {
  const uniqueCapabilities = [...new Set(capabilities)];

  for (const capability of uniqueCapabilities) {
    if (!isDAppCapability(capability)) {
      throw new Error(`Unsupported dApp capability: ${capability}`);
    }
  }

  return uniqueCapabilities;
}

export function createDAppPermission(input: CreateDAppPermissionInput): DAppPermission {
  if (input.accountId.trim().length === 0) {
    throw new Error("Account ID is required");
  }

  const capabilities = normalizeCapabilities(input.capabilities);

  if (!capabilities.includes("connect")) {
    throw new Error("dApp permission must include connect capability");
  }

  return {
    origin: normalizeDAppOrigin(input.origin),
    accountId: input.accountId,
    chain: input.chain,
    capabilities,
    grantedAt: input.grantedAt ?? new Date().toISOString(),
  };
}

export function hasDAppCapability(permission: DAppPermission, capability: DAppCapability): boolean {
  return permission.capabilities.includes(capability);
}

export function isPermissionBoundTo(
  permission: DAppPermission,
  origin: string,
  accountId: string,
  chain: SupportedChain,
): boolean {
  return (
    permission.origin === normalizeDAppOrigin(origin) &&
    permission.accountId === accountId &&
    permission.chain === chain
  );
}
