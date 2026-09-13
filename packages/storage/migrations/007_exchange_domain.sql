-- Exchange / custody domain persistence foundation
--
-- This schema is intentionally separate from the self-custody wallet domain.
-- PostgreSQL remains the authoritative source of truth.
--
-- Never store private keys, seed phrases, signing secrets, custody
-- credentials, or other key material in these tables.

CREATE TABLE IF NOT EXISTS exchange_accounts (
    id UUID PRIMARY KEY,

    owner_type TEXT NOT NULL,
    owner_id TEXT NOT NULL,

    kind TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT exchange_accounts_owner_type_check
        CHECK (owner_type IN ('customer', 'platform')),

    CONSTRAINT exchange_accounts_kind_check
        CHECK (
            kind IN (
                'customer',
                'treasury',
                'fee',
                'operational'
            )
        ),

    CONSTRAINT exchange_accounts_status_check
        CHECK (
            status IN (
                'active',
                'blocked'
            )
        ),

    CONSTRAINT exchange_accounts_owner_id_not_empty
        CHECK (length(trim(owner_id)) > 0),

    CONSTRAINT exchange_accounts_owner_kind_check
        CHECK (
            (owner_type = 'customer' AND kind = 'customer')
            OR
            (owner_type = 'platform' AND kind <> 'customer')
        ),

    UNIQUE(owner_type, owner_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_exchange_accounts_owner
    ON exchange_accounts(owner_type, owner_id);

CREATE INDEX IF NOT EXISTS idx_exchange_accounts_kind
    ON exchange_accounts(kind);

CREATE INDEX IF NOT EXISTS idx_exchange_accounts_status
    ON exchange_accounts(status);


CREATE TABLE IF NOT EXISTS exchange_subaccounts (
    id UUID PRIMARY KEY,

    exchange_account_id UUID NOT NULL
        REFERENCES exchange_accounts(id),

    name TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT exchange_subaccounts_name_not_empty
        CHECK (length(trim(name)) > 0),

    UNIQUE(exchange_account_id, name)
);

CREATE INDEX IF NOT EXISTS idx_exchange_subaccounts_account
    ON exchange_subaccounts(exchange_account_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_id_network_id
    ON assets(id, network_id);

CREATE TABLE IF NOT EXISTS exchange_asset_accounts (
    id UUID PRIMARY KEY,

    exchange_account_id UUID NOT NULL
        REFERENCES exchange_accounts(id),

    asset_id UUID NOT NULL,

    network_id UUID NOT NULL
        REFERENCES networks(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(exchange_account_id, asset_id),
    UNIQUE(id, asset_id),
    UNIQUE(id, network_id),

    CONSTRAINT exchange_asset_accounts_asset_network_fk
        FOREIGN KEY (asset_id, network_id)
        REFERENCES assets(id, network_id)
);

CREATE INDEX IF NOT EXISTS idx_exchange_asset_accounts_account
    ON exchange_asset_accounts(exchange_account_id);

CREATE INDEX IF NOT EXISTS idx_exchange_asset_accounts_asset
    ON exchange_asset_accounts(asset_id);


CREATE TABLE IF NOT EXISTS exchange_deposits (
    id UUID PRIMARY KEY,

    exchange_asset_account_id UUID NOT NULL,

    network_id UUID NOT NULL,

    CONSTRAINT exchange_deposits_asset_account_network_fk
        FOREIGN KEY (exchange_asset_account_id, network_id)
        REFERENCES exchange_asset_accounts(id, network_id),

    transaction_hash TEXT NOT NULL,

    amount NUMERIC(78, 0) NOT NULL,

    status TEXT NOT NULL,

    reference TEXT NOT NULL UNIQUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT exchange_deposits_amount_check
        CHECK (amount > 0),

    CONSTRAINT exchange_deposits_status_check
        CHECK (
            status IN (
                'detected',
                'confirmed',
                'credited',
                'reversed'
            )
        ),

    CONSTRAINT exchange_deposits_transaction_hash_not_empty
        CHECK (length(trim(transaction_hash)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_exchange_deposits_asset_account
    ON exchange_deposits(exchange_asset_account_id);

CREATE INDEX IF NOT EXISTS idx_exchange_deposits_network
    ON exchange_deposits(network_id);

CREATE INDEX IF NOT EXISTS idx_exchange_deposits_transaction
    ON exchange_deposits(network_id, transaction_hash);

CREATE INDEX IF NOT EXISTS idx_exchange_deposits_status
    ON exchange_deposits(status);


CREATE TABLE IF NOT EXISTS exchange_withdrawals (
    id UUID PRIMARY KEY,

    exchange_asset_account_id UUID NOT NULL,

    network_id UUID NOT NULL,

    CONSTRAINT exchange_withdrawals_asset_account_network_fk
        FOREIGN KEY (exchange_asset_account_id, network_id)
        REFERENCES exchange_asset_accounts(id, network_id),

    destination TEXT NOT NULL,

    amount NUMERIC(78, 0) NOT NULL,

    status TEXT NOT NULL,

    reference TEXT NOT NULL UNIQUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT exchange_withdrawals_amount_check
        CHECK (amount > 0),

    CONSTRAINT exchange_withdrawals_status_check
        CHECK (
            status IN (
                'requested',
                'approved',
                'rejected',
                'submitted',
                'confirmed',
                'failed'
            )
        ),

    CONSTRAINT exchange_withdrawals_destination_not_empty
        CHECK (length(trim(destination)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_exchange_withdrawals_asset_account
    ON exchange_withdrawals(exchange_asset_account_id);

CREATE INDEX IF NOT EXISTS idx_exchange_withdrawals_network
    ON exchange_withdrawals(network_id);

CREATE INDEX IF NOT EXISTS idx_exchange_withdrawals_status
    ON exchange_withdrawals(status);


CREATE TABLE IF NOT EXISTS exchange_trades (
    id UUID PRIMARY KEY,

    buyer_exchange_asset_account_id UUID NOT NULL,

    seller_exchange_asset_account_id UUID NOT NULL,

    base_asset_id UUID NOT NULL
        REFERENCES assets(id),

    quote_asset_id UUID NOT NULL
        REFERENCES assets(id),

    base_amount NUMERIC(78, 0) NOT NULL,
    quote_amount NUMERIC(78, 0) NOT NULL,

    price_numerator NUMERIC(78, 0) NOT NULL,
    price_denominator NUMERIC(78, 0) NOT NULL,

    status TEXT NOT NULL,

    reference TEXT NOT NULL UNIQUE,

    executed_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT exchange_trades_base_amount_check
        CHECK (base_amount > 0),

    CONSTRAINT exchange_trades_quote_amount_check
        CHECK (quote_amount > 0),

    CONSTRAINT exchange_trades_price_numerator_check
        CHECK (price_numerator > 0),

    CONSTRAINT exchange_trades_price_denominator_check
        CHECK (price_denominator > 0),

    CONSTRAINT exchange_trades_status_check
        CHECK (
            status IN (
                'executed',
                'reversed'
            )
        ),

    CONSTRAINT exchange_trades_accounts_differ_check
        CHECK (
            buyer_exchange_asset_account_id
            <> seller_exchange_asset_account_id
        ),

    CONSTRAINT exchange_trades_assets_differ_check
        CHECK (
            base_asset_id <> quote_asset_id
        ),

    CONSTRAINT exchange_trades_buyer_base_asset_fk
        FOREIGN KEY (buyer_exchange_asset_account_id, base_asset_id)
        REFERENCES exchange_asset_accounts(id, asset_id),

    CONSTRAINT exchange_trades_seller_base_asset_fk
        FOREIGN KEY (seller_exchange_asset_account_id, base_asset_id)
        REFERENCES exchange_asset_accounts(id, asset_id),

    CONSTRAINT exchange_trades_buyer_quote_asset_fk
        FOREIGN KEY (buyer_exchange_asset_account_id, quote_asset_id)
        REFERENCES exchange_asset_accounts(id, asset_id),

    CONSTRAINT exchange_trades_seller_quote_asset_fk
        FOREIGN KEY (seller_exchange_asset_account_id, quote_asset_id)
        REFERENCES exchange_asset_accounts(id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_exchange_trades_buyer_account
    ON exchange_trades(buyer_exchange_asset_account_id);

CREATE INDEX IF NOT EXISTS idx_exchange_trades_seller_account
    ON exchange_trades(seller_exchange_asset_account_id);

CREATE INDEX IF NOT EXISTS idx_exchange_trades_base_asset
    ON exchange_trades(base_asset_id);

CREATE INDEX IF NOT EXISTS idx_exchange_trades_quote_asset
    ON exchange_trades(quote_asset_id);

CREATE INDEX IF NOT EXISTS idx_exchange_trades_status
    ON exchange_trades(status);

CREATE INDEX IF NOT EXISTS idx_exchange_trades_executed_at
    ON exchange_trades(executed_at);


CREATE TABLE IF NOT EXISTS exchange_fees (
    id UUID PRIMARY KEY,

    trade_id UUID NOT NULL
        REFERENCES exchange_trades(id),

        source_exchange_asset_account_id UUID NOT NULL,

    fee_exchange_asset_account_id UUID NOT NULL,

    asset_id UUID NOT NULL,

    CONSTRAINT exchange_fees_source_asset_fk
        FOREIGN KEY (source_exchange_asset_account_id, asset_id)
        REFERENCES exchange_asset_accounts(id, asset_id),

    CONSTRAINT exchange_fees_fee_asset_fk
        FOREIGN KEY (fee_exchange_asset_account_id, asset_id)
        REFERENCES exchange_asset_accounts(id, asset_id),

    amount NUMERIC(78, 0) NOT NULL,

    status TEXT NOT NULL,

    reference TEXT NOT NULL UNIQUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT exchange_fees_amount_check
        CHECK (amount > 0),

    CONSTRAINT exchange_fees_status_check
        CHECK (
            status IN (
                'charged',
                'reversed'
            )
        ),

    CONSTRAINT exchange_fees_accounts_differ_check
        CHECK (
            source_exchange_asset_account_id
            <> fee_exchange_asset_account_id
        )
);

CREATE INDEX IF NOT EXISTS idx_exchange_fees_trade
    ON exchange_fees(trade_id);

CREATE INDEX IF NOT EXISTS idx_exchange_fees_source_account
    ON exchange_fees(source_exchange_asset_account_id);

CREATE INDEX IF NOT EXISTS idx_exchange_fees_fee_account
    ON exchange_fees(fee_exchange_asset_account_id);

CREATE INDEX IF NOT EXISTS idx_exchange_fees_asset
    ON exchange_fees(asset_id);

CREATE INDEX IF NOT EXISTS idx_exchange_fees_status
    ON exchange_fees(status);
