import { randomUUID } from "node:crypto";

import type {
  ReconciliationComparison,
  ReconciliationRepository,
  ReconciliationSource,
  ReconciliationStatus,
} from "@crypto-wallet/ledger-core";
import type { Storage } from "@crypto-wallet/storage";

interface ReconciliationComparisonRow {
  id: string;
  asset_id: string;
  network_id: string | null;
  account_id: string | null;
  expected_observation_status:
    | "available"
    | "unavailable";
  actual_observation_status:
    | "available"
    | "unavailable";
  expected_source: ReconciliationSource;
  expected_amount: string | null;
  actual_source: ReconciliationSource;
  actual_amount: string | null;
  difference: string | null;
  status: ReconciliationStatus;
  expected_observed_at: Date;
  actual_observed_at: Date;
  expected_reference: string | null;
  actual_reference: string | null;
  created_at: Date;
}

export class PostgresReconciliationRepository
  implements ReconciliationRepository
{
  constructor(private readonly storage: Storage) {}

  async save(comparison: ReconciliationComparison): Promise<void> {
    await this.storage.query(
      `
        INSERT INTO reconciliation_comparisons (
          id,
          asset_id,
          network_id,
          account_id,
          expected_source,
          expected_amount,
          actual_source,
          actual_amount,
          expected_observation_status,
          actual_observation_status,
          difference,
          status,
          expected_observed_at,
          actual_observed_at,
          expected_reference,
          actual_reference
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16
        )
      `,
      [
        randomUUID(),
        comparison.scope.assetId,
        comparison.scope.networkId ?? null,
        comparison.scope.accountId ?? null,
        comparison.expected.source,
        comparison.expected.amount,
        comparison.actual.source,
        comparison.actual.amount,
        comparison.expected.status,
        comparison.actual.status,
        comparison.difference,
        comparison.status,
        comparison.expected.observedAt,
        comparison.actual.observedAt,
        comparison.expected.reference ?? null,
        comparison.actual.reference ?? null,
      ],
    );
  }

  async findLatest(
    assetId: string,
    networkId?: string,
    accountId?: string,
  ): Promise<ReconciliationComparison | null> {
    const result = await this.storage.query<ReconciliationComparisonRow>(
      `
        SELECT
          id,
          asset_id,
          network_id,
          account_id,
          expected_source,
          expected_amount,
          actual_source,
          actual_amount,
          expected_observation_status,
          actual_observation_status,
          difference,
          status,
          expected_observed_at,
          actual_observed_at,
          expected_reference,
          actual_reference,
          created_at
        FROM reconciliation_comparisons
        WHERE asset_id = $1
          AND network_id IS NOT DISTINCT FROM $2
          AND account_id IS NOT DISTINCT FROM $3
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [
        assetId,
        networkId ?? null,
        accountId ?? null,
      ],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapReconciliationComparison(row);
  }
}

function mapReconciliationComparison(
  row: ReconciliationComparisonRow,
): ReconciliationComparison {
  const scope = {
    assetId: row.asset_id,
    ...(row.network_id !== null
      ? { networkId: row.network_id }
      : {}),
    ...(row.account_id !== null
      ? { accountId: row.account_id }
      : {}),
  };

  return {
    scope,
    expected: {
      source: row.expected_source,
      scope,
      amount: row.expected_amount,
      status: row.expected_observation_status,
      observedAt: row.expected_observed_at.toISOString(),
      ...(row.expected_reference !== null
        ? { reference: row.expected_reference }
        : {}),
    },
    actual: {
      source: row.actual_source,
      scope,
      amount: row.actual_amount,
      status: row.actual_observation_status,
      observedAt: row.actual_observed_at.toISOString(),
      ...(row.actual_reference !== null
        ? { reference: row.actual_reference }
        : {}),
    },
    difference: row.difference,
    status: row.status,
  };
}