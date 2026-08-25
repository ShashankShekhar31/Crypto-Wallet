-- Day 7: Identity & device security foundation
-- PostgreSQL remains the authoritative source of truth.
-- Never store wallet seed phrases, private keys, or signing secrets here.

CREATE TABLE IF NOT EXISTS identity_accounts (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    normalized_email TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT identity_accounts_email_not_empty
        CHECK (length(trim(normalized_email)) > 0),

    CONSTRAINT identity_accounts_email_lowercase
        CHECK (normalized_email = lower(normalized_email)),

    CONSTRAINT identity_accounts_status_check
        CHECK (
            status IN (
                'active',
                'locked',
                'recovery_required',
                'disabled'
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_identity_accounts_user_id
    ON identity_accounts(user_id);

CREATE TABLE IF NOT EXISTS password_credentials (
    id UUID PRIMARY KEY,
    identity_account_id UUID NOT NULL UNIQUE
        REFERENCES identity_accounts(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    failed_attempt_count INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,

    CONSTRAINT password_credentials_failed_attempt_count_check
        CHECK (failed_attempt_count >= 0)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,

    token_family_id UUID NOT NULL,
    refresh_token_hash TEXT NOT NULL UNIQUE,

    status TEXT NOT NULL DEFAULT 'active',

    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    idle_expires_at TIMESTAMPTZ NOT NULL,

    rotated_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT,

    replaced_by_session_id UUID REFERENCES auth_sessions(id),

    CONSTRAINT auth_sessions_status_check
        CHECK (
            status IN (
                'active',
                'rotated',
                'revoked',
                'expired',
                'replay_detected'
            )
        ),

    CONSTRAINT auth_sessions_expiry_check
        CHECK (expires_at > issued_at),

    CONSTRAINT auth_sessions_idle_expiry_check
        CHECK (idle_expires_at > issued_at),

    CONSTRAINT auth_sessions_revocation_check
        CHECK (
            revoked_at IS NULL
            OR status IN ('revoked', 'replay_detected')
        )
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id
    ON auth_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_device_id
    ON auth_sessions(device_id);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_token_family_id
    ON auth_sessions(token_family_id);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_active
    ON auth_sessions(user_id, status, expires_at);

CREATE TABLE IF NOT EXISTS passkey_credentials (
    id UUID PRIMARY KEY,
    identity_account_id UUID NOT NULL
        REFERENCES identity_accounts(id) ON DELETE CASCADE,

    credential_id BYTEA NOT NULL UNIQUE,
    public_key BYTEA NOT NULL,

    sign_count BIGINT NOT NULL DEFAULT 0,
    backed_up BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,

    CONSTRAINT passkey_credentials_sign_count_check
        CHECK (sign_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_passkey_credentials_identity_account_id
    ON passkey_credentials(identity_account_id);

CREATE TABLE IF NOT EXISTS totp_factors (
    id UUID PRIMARY KEY,
    identity_account_id UUID NOT NULL
        REFERENCES identity_accounts(id) ON DELETE CASCADE,

    encrypted_secret BYTEA NOT NULL,
    secret_nonce BYTEA NOT NULL,
    encryption_key_version TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    enabled_at TIMESTAMPTZ,
    disabled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_totp_factors_identity_account_id
    ON totp_factors(identity_account_id);

CREATE TABLE IF NOT EXISTS recovery_codes (
    id UUID PRIMARY KEY,
    identity_account_id UUID NOT NULL
        REFERENCES identity_accounts(id) ON DELETE CASCADE,

    code_hash TEXT NOT NULL UNIQUE,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recovery_codes_identity_account_id
    ON recovery_codes(identity_account_id);

CREATE TABLE IF NOT EXISTS auth_events (
    id UUID PRIMARY KEY,

    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    session_id UUID REFERENCES auth_sessions(id) ON DELETE SET NULL,

    event_type TEXT NOT NULL,
    outcome TEXT NOT NULL,

    source_ip_hash TEXT,
    user_agent TEXT,

    failure_code TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT auth_events_outcome_check
        CHECK (
            outcome IN (
                'success',
                'failure',
                'blocked',
                'suspicious'
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_auth_events_user_id
    ON auth_events(user_id, occurred_at);

CREATE INDEX IF NOT EXISTS idx_auth_events_device_id
    ON auth_events(device_id, occurred_at);

CREATE INDEX IF NOT EXISTS idx_auth_events_type_time
    ON auth_events(event_type, occurred_at);
