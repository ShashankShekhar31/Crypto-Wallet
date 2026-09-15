import type { CustodyTier } from "./key-management.js";

export interface CustodyTierPolicy {
  readonly tier: CustodyTier;
  readonly description: string;
  readonly requiresManualAuthorization: boolean;
  readonly requiresMultipleApprovers: boolean;
}

export const CUSTODY_TIER_POLICIES: Readonly<Record<CustodyTier, CustodyTierPolicy>> =
  Object.freeze({
    hot: Object.freeze({
      tier: "hot",
      description: "Operational wallet for frequent signing activity",
      requiresManualAuthorization: false,
      requiresMultipleApprovers: false,
    }),
    warm: Object.freeze({
      tier: "warm",
      description: "Restricted operational wallet for controlled signing activity",
      requiresManualAuthorization: true,
      requiresMultipleApprovers: true,
    }),
    cold: Object.freeze({
      tier: "cold",
      description: "Highly restricted wallet for offline or ceremony-based operations",
      requiresManualAuthorization: true,
      requiresMultipleApprovers: true,
    }),
  });

export function getCustodyTierPolicy(tier: CustodyTier): CustodyTierPolicy {
  return CUSTODY_TIER_POLICIES[tier];
}
