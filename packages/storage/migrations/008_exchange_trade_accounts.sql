-- Exchange trade account model correction
--
-- Replace the original two-account trade representation with explicit
-- base/quote asset accounts for both buyer and seller.
--
-- Migration 007 is already applied and must not be modified.

ALTER TABLE exchange_trades
    DROP CONSTRAINT IF EXISTS exchange_trades_accounts_differ_check,
    DROP CONSTRAINT IF EXISTS exchange_trades_buyer_base_asset_fk,
    DROP CONSTRAINT IF EXISTS exchange_trades_buyer_quote_asset_fk,
    DROP CONSTRAINT IF EXISTS exchange_trades_seller_base_asset_fk,
    DROP CONSTRAINT IF EXISTS exchange_trades_seller_quote_asset_fk;

DROP INDEX IF EXISTS idx_exchange_trades_buyer_account;
DROP INDEX IF EXISTS idx_exchange_trades_seller_account;

ALTER TABLE exchange_trades
    DROP COLUMN IF EXISTS buyer_exchange_asset_account_id,
    DROP COLUMN IF EXISTS seller_exchange_asset_account_id;

ALTER TABLE exchange_trades
    ADD COLUMN buyer_base_exchange_asset_account_id UUID NOT NULL,
    ADD COLUMN buyer_quote_exchange_asset_account_id UUID NOT NULL,
    ADD COLUMN seller_base_exchange_asset_account_id UUID NOT NULL,
    ADD COLUMN seller_quote_exchange_asset_account_id UUID NOT NULL;

ALTER TABLE exchange_trades
    ADD CONSTRAINT exchange_trades_accounts_differ_check
        CHECK (
            buyer_base_exchange_asset_account_id
            <> seller_base_exchange_asset_account_id
            OR
            buyer_quote_exchange_asset_account_id
            <> seller_quote_exchange_asset_account_id
        ),

    ADD CONSTRAINT exchange_trades_buyer_base_asset_fk
        FOREIGN KEY (
            buyer_base_exchange_asset_account_id,
            base_asset_id
        )
        REFERENCES exchange_asset_accounts(id, asset_id),

    ADD CONSTRAINT exchange_trades_buyer_quote_asset_fk
        FOREIGN KEY (
            buyer_quote_exchange_asset_account_id,
            quote_asset_id
        )
        REFERENCES exchange_asset_accounts(id, asset_id),

    ADD CONSTRAINT exchange_trades_seller_base_asset_fk
        FOREIGN KEY (
            seller_base_exchange_asset_account_id,
            base_asset_id
        )
        REFERENCES exchange_asset_accounts(id, asset_id),

    ADD CONSTRAINT exchange_trades_seller_quote_asset_fk
        FOREIGN KEY (
            seller_quote_exchange_asset_account_id,
            quote_asset_id
        )
        REFERENCES exchange_asset_accounts(id, asset_id);

CREATE INDEX IF NOT EXISTS idx_exchange_trades_buyer_base_account
    ON exchange_trades(buyer_base_exchange_asset_account_id);

CREATE INDEX IF NOT EXISTS idx_exchange_trades_buyer_quote_account
    ON exchange_trades(buyer_quote_exchange_asset_account_id);

CREATE INDEX IF NOT EXISTS idx_exchange_trades_seller_base_account
    ON exchange_trades(seller_base_exchange_asset_account_id);

CREATE INDEX IF NOT EXISTS idx_exchange_trades_seller_quote_account
    ON exchange_trades(seller_quote_exchange_asset_account_id);