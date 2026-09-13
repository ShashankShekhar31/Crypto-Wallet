-- Reconciliation observations are an audit trail between
-- the authoritative ledger and external accounting sources.

CREATE TABLE IF NOT EXISTS reconciliation_comparisons (
    id UUID PRIMARY KEY,

    asset_id UUID NOT NULL,

    network_id UUID,
    account_id UUID,

    expected_source TEXT NOT NULL,
    expected_amount NUMERIC(78, 0) NOT NULL,

    actual_source TEXT NOT NULL,
    actual_amount NUMERIC(78, 0) NOT NULL,

    difference NUMERIC(78, 0) NOT NULL,

    status TEXT NOT NULL,

    expected_observed_at TIMESTAMPTZ NOT NULL,
    actual_observed_at TIMESTAMPTZ NOT NULL,

    expected_reference TEXT,
    actual_reference TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT reconciliation_expected_source_check
        CHECK (expected_source IN ('ledger', 'custody', 'blockchain', 'fiat')),

    CONSTRAINT reconciliation_actual_source_check
        CHECK (actual_source IN ('ledger', 'custody', 'blockchain', 'fiat')),

    CONSTRAINT reconciliation_status_check
        CHECK (status IN ('matched', 'mismatched', 'unavailable')),

    CONSTRAINT reconciliation_expected_amount_check
        CHECK (expected_amount >= 0),

    CONSTRAINT reconciliation_actual_amount_check
        CHECK (actual_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_scope
    ON reconciliation_comparisons(asset_id, network_id, account_id);

CREATE INDEX IF NOT EXISTS idx_reconciliation_status
    ON reconciliation_comparisons(status);

CREATE INDEX IF NOT EXISTS idx_reconciliation_created_at
    ON reconciliation_comparisons(created_at DESC);