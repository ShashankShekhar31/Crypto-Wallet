-- Wallet domain foundation
-- PostgreSQL remains the authoritative source of truth.
-- Never store wallet seed phrases, private keys, or signing secrets here.

CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    platform TEXT NOT NULL,
    name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_devices_user_id
    ON devices(user_id);

CREATE INDEX IF NOT EXISTS idx_devices_active
    ON devices(user_id, revoked_at);

CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY,
    wallet_id UUID NOT NULL REFERENCES wallets(id),
    name TEXT NOT NULL,
    account_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(wallet_id, account_index)
);

CREATE INDEX IF NOT EXISTS idx_accounts_wallet_id
    ON accounts(wallet_id);

CREATE TABLE IF NOT EXISTS networks (
    id UUID PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    chain TEXT NOT NULL,
    environment TEXT NOT NULL,
    chain_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_networks_chain
    ON networks(chain);

CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY,
    network_id UUID NOT NULL REFERENCES networks(id),
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    decimals INTEGER NOT NULL,
    asset_type TEXT NOT NULL,
    contract_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(network_id, symbol),
    UNIQUE(network_id, contract_address)
);

CREATE INDEX IF NOT EXISTS idx_assets_network_id
    ON assets(network_id);

CREATE TABLE IF NOT EXISTS addresses (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id),
    network_id UUID NOT NULL REFERENCES networks(id),
    address TEXT NOT NULL,
    derivation_index INTEGER,
    is_change BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(network_id, address)
);

CREATE INDEX IF NOT EXISTS idx_addresses_account_id
    ON addresses(account_id);

CREATE INDEX IF NOT EXISTS idx_addresses_network_id
    ON addresses(network_id);

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id),
    network_id UUID NOT NULL REFERENCES networks(id),
    asset_id UUID REFERENCES assets(id),
    tx_hash TEXT,
    idempotency_key TEXT,
    direction TEXT NOT NULL,
    status TEXT NOT NULL,
    amount NUMERIC(78, 0),
    fee_amount NUMERIC(78, 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(network_id, tx_hash),
    UNIQUE(account_id, idempotency_key),
    CONSTRAINT transactions_direction_check
        CHECK (direction IN ('incoming', 'outgoing')),
    CONSTRAINT transactions_status_check
        CHECK (
            status IN (
                'draft',
                'signed',
                'submitted',
                'pending',
                'confirmed',
                'failed'
            )
        ),
    CONSTRAINT transactions_amount_check
        CHECK (amount IS NULL OR amount >= 0),
    CONSTRAINT transactions_fee_amount_check
        CHECK (fee_amount IS NULL OR fee_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_transactions_account_id
    ON transactions(account_id);

CREATE INDEX IF NOT EXISTS idx_transactions_network_id
    ON transactions(network_id);

CREATE INDEX IF NOT EXISTS idx_transactions_asset_id
    ON transactions(asset_id);

CREATE INDEX IF NOT EXISTS idx_transactions_status
    ON transactions(status);

CREATE INDEX IF NOT EXISTS idx_transactions_created_at
    ON transactions(created_at);
