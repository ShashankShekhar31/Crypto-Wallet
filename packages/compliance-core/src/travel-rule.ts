export type TravelRulePartyType = "individual" | "business";

export interface TravelRuleParty {
  type: TravelRulePartyType;
  name: string;
  accountIdentifier: string;
  institutionName?: string;
  institutionIdentifier?: string;
  jurisdiction?: string;
}

export interface TravelRuleTransfer {
  transferId: string;
  assetId: string;
  networkId: string;
  amount: string;
  originator: TravelRuleParty;
  beneficiary: TravelRuleParty;
  originatorVasp?: string;
  beneficiaryVasp?: string;
  transactionReference?: string;
  createdAt: string;
}

export type TravelRuleValidationCode =
  | "missing_transfer_id"
  | "missing_asset_id"
  | "missing_network_id"
  | "invalid_amount"
  | "missing_originator_name"
  | "missing_originator_account"
  | "missing_beneficiary_name"
  | "missing_beneficiary_account";

export interface TravelRuleValidationResult {
  valid: boolean;
  missing: readonly TravelRuleValidationCode[];
}

export function validateTravelRuleTransfer(
  transfer: TravelRuleTransfer,
): TravelRuleValidationResult {
  const missing: TravelRuleValidationCode[] = [];

  if (transfer.transferId.trim().length === 0) {
    missing.push("missing_transfer_id");
  }

  if (transfer.assetId.trim().length === 0) {
    missing.push("missing_asset_id");
  }

  if (transfer.networkId.trim().length === 0) {
    missing.push("missing_network_id");
  }

  if (!/^[0-9]+$/.test(transfer.amount) || BigInt(transfer.amount) <= 0n) {
    missing.push("invalid_amount");
  }

  if (transfer.originator.name.trim().length === 0) {
    missing.push("missing_originator_name");
  }

  if (transfer.originator.accountIdentifier.trim().length === 0) {
    missing.push("missing_originator_account");
  }

  if (transfer.beneficiary.name.trim().length === 0) {
    missing.push("missing_beneficiary_name");
  }

  if (transfer.beneficiary.accountIdentifier.trim().length === 0) {
    missing.push("missing_beneficiary_account");
  }

  return Object.freeze({
    valid: missing.length === 0,
    missing: Object.freeze(missing),
  });
}
