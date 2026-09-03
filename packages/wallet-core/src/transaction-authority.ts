export type TransactionStateSource = "client" | "client-optimistic" | "provider" | "ledger";

export function isAuthoritativeSettlementSource(source: TransactionStateSource): boolean {
  return source === "provider" || source === "ledger";
}
