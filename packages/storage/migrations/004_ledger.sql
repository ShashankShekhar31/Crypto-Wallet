-- Ledger foundation
-- The ledger is the authoritative accounting layer.

CREATE TABLE IF NOT EXISTS ledger_accounts (
    id UUID PRIMARY KEY,
    wallet_id UUID NOT NULL REFERENCES wallets(id),
    asset_id UUID NOT NULL,
    chain TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(wallet_id, asset_id, chain)
);

CREATE INDEX IF NOT EXISTS idx_ledger_accounts_wallet_id
    ON ledger_accounts(wallet_id);

CREATE INDEX IF NOT EXISTS idx_ledger_accounts_asset
    ON ledger_accounts(asset_id);


CREATE TABLE IF NOT EXISTS ledger_transactions (
    id UUID PRIMARY KEY,
    reference TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ledger_transactions_status_check
        CHECK (status IN ('pending', 'posted', 'reversed'))
);

CREATE INDEX IF NOT EXISTS idx_ledger_transactions_status
    ON ledger_transactions(status);


CREATE TABLE IF NOT EXISTS ledger_entries (
    id UUID PRIMARY KEY,
    ledger_account_id UUID NOT NULL
        REFERENCES ledger_accounts(id),

    transaction_id UUID NOT NULL
        REFERENCES ledger_transactions(id),

    type TEXT NOT NULL,
    amount NUMERIC(78, 0) NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ledger_entries_type_check
        CHECK (type IN ('debit', 'credit')),

    CONSTRAINT ledger_entries_status_check
        CHECK (status IN ('pending', 'posted', 'reversed')),

    CONSTRAINT ledger_entries_amount_check
        CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_account
    ON ledger_entries(ledger_account_id);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_transaction
    ON ledger_entries(transaction_id);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_status
    ON ledger_entries(status);