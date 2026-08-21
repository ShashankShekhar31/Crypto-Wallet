-- Database integrity constraints

ALTER TABLE users
    ADD CONSTRAINT users_id_not_zero
    CHECK (id <> '00000000-0000-0000-0000-000000000000');

ALTER TABLE wallets
    ADD CONSTRAINT wallets_name_not_empty
    CHECK (length(trim(name)) > 0);

ALTER TABLE wallet_accounts
    ADD CONSTRAINT wallet_accounts_chain_not_empty
    CHECK (length(trim(chain)) > 0);

ALTER TABLE wallet_accounts
    ADD CONSTRAINT wallet_accounts_chain_lowercase
    CHECK (chain = lower(chain));

ALTER TABLE wallet_accounts
    ADD CONSTRAINT wallet_accounts_address_not_empty
    CHECK (length(trim(address)) > 0);