-- Compliance and risk domain persistence foundation
--
-- Compliance is a separate domain from identity, exchange, ledger,
-- and custody. These tables store compliance decisions, screening
-- observations, risk assessments, alerts, and cases.
--
-- Do not store passwords, private keys, seed phrases, signing secrets,
-- authentication secrets, or raw identity documents here.

CREATE TABLE IF NOT EXISTS compliance_subjects (
    id UUID PRIMARY KEY,

    user_id UUID NOT NULL,

    subject_type TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'active',

    risk_level TEXT NOT NULL DEFAULT 'unknown',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),


    CONSTRAINT compliance_subjects_subject_type_check
        CHECK (
            subject_type IN (
                'individual',
                'business'
            )
        ),

    CONSTRAINT compliance_subjects_status_check
        CHECK (
            status IN (
                'active',
                'restricted',
                'blocked',
                'closed'
            )
        ),

    CONSTRAINT compliance_subjects_risk_level_check
        CHECK (
            risk_level IN (
                'unknown',
                'low',
                'medium',
                'high',
                'critical'
            )
        ),

    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_compliance_subjects_status
    ON compliance_subjects(status);

CREATE INDEX IF NOT EXISTS idx_compliance_subjects_risk_level
    ON compliance_subjects(risk_level);


CREATE TABLE IF NOT EXISTS compliance_screenings (
    id UUID PRIMARY KEY,

    subject_id UUID NOT NULL
        REFERENCES compliance_subjects(id),

    screening_type TEXT NOT NULL,

    provider TEXT NOT NULL,

    status TEXT NOT NULL,

    provider_reference TEXT,

    result JSONB NOT NULL DEFAULT '{}'::jsonb,

    screened_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT compliance_screenings_type_check
        CHECK (
            screening_type IN (
                'kyc',
                'kyb',
                'sanctions',
                'pep',
                'adverse_media'
            )
        ),

    CONSTRAINT compliance_screenings_provider_not_empty
        CHECK (length(trim(provider)) > 0),

    CONSTRAINT compliance_screenings_status_check
        CHECK (
            status IN (
                'pending',
                'clear',
                'match',
                'review',
                'failed'
            )
        ),

    CONSTRAINT compliance_screenings_reference_not_empty
        CHECK (
            provider_reference IS NULL
            OR length(trim(provider_reference)) > 0
        )
);

CREATE INDEX IF NOT EXISTS idx_compliance_screenings_subject
    ON compliance_screenings(subject_id, screened_at DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_screenings_type
    ON compliance_screenings(screening_type, screened_at DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_screenings_status
    ON compliance_screenings(status);


CREATE TABLE IF NOT EXISTS compliance_risk_assessments (
    id UUID PRIMARY KEY,

    subject_id UUID NOT NULL
        REFERENCES compliance_subjects(id),

    score INTEGER NOT NULL,

    risk_level TEXT NOT NULL,

    reasons JSONB NOT NULL DEFAULT '[]'::jsonb,

    assessed_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT compliance_risk_assessments_score_check
        CHECK (score >= 0 AND score <= 100),

    CONSTRAINT compliance_risk_assessments_risk_level_check
        CHECK (
            risk_level IN (
                'low',
                'medium',
                'high',
                'critical'
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_compliance_risk_assessments_subject
    ON compliance_risk_assessments(subject_id, assessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_risk_assessments_level
    ON compliance_risk_assessments(risk_level, assessed_at DESC);


CREATE TABLE IF NOT EXISTS transaction_monitoring_alerts (
    id UUID PRIMARY KEY,

    subject_id UUID
        REFERENCES compliance_subjects(id),

    transaction_type TEXT NOT NULL,

    transaction_id TEXT NOT NULL,

    rule_code TEXT NOT NULL,

    risk_score INTEGER NOT NULL,

    status TEXT NOT NULL DEFAULT 'open',

    details JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    resolved_at TIMESTAMPTZ,

    CONSTRAINT transaction_monitoring_alerts_transaction_type_check
        CHECK (
            transaction_type IN (
                'deposit',
                'withdrawal',
                'trade',
                'transfer'
            )
        ),

    CONSTRAINT transaction_monitoring_alerts_transaction_id_not_empty
        CHECK (length(trim(transaction_id)) > 0),

    CONSTRAINT transaction_monitoring_alerts_rule_code_not_empty
        CHECK (length(trim(rule_code)) > 0),

    CONSTRAINT transaction_monitoring_alerts_score_check
        CHECK (risk_score >= 0 AND risk_score <= 100),

    CONSTRAINT transaction_monitoring_alerts_status_check
        CHECK (
            status IN (
                'open',
                'under_review',
                'dismissed',
                'escalated',
                'resolved'
            )
        ),

    CONSTRAINT transaction_monitoring_alerts_resolution_check
        CHECK (
            (
                status IN ('open', 'under_review', 'escalated')
                AND resolved_at IS NULL
            )
            OR
            (
                status IN ('dismissed', 'resolved')
                AND resolved_at IS NOT NULL
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_transaction_monitoring_alerts_subject
    ON transaction_monitoring_alerts(subject_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transaction_monitoring_alerts_status
    ON transaction_monitoring_alerts(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transaction_monitoring_alerts_transaction
    ON transaction_monitoring_alerts(transaction_type, transaction_id);


CREATE TABLE IF NOT EXISTS compliance_cases (
    id UUID PRIMARY KEY,

    subject_id UUID
        REFERENCES compliance_subjects(id),

    case_type TEXT NOT NULL,

    priority TEXT NOT NULL DEFAULT 'normal',

    status TEXT NOT NULL DEFAULT 'open',

    reason TEXT NOT NULL,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    resolved_at TIMESTAMPTZ,

    CONSTRAINT compliance_cases_type_check
        CHECK (
            case_type IN (
                'kyc_review',
                'kyb_review',
                'sanctions_review',
                'risk_review',
                'transaction_monitoring',
                'manual_review'
            )
        ),

    CONSTRAINT compliance_cases_priority_check
        CHECK (
            priority IN (
                'low',
                'normal',
                'high',
                'critical'
            )
        ),

    CONSTRAINT compliance_cases_status_check
        CHECK (
            status IN (
                'open',
                'investigating',
                'escalated',
                'resolved',
                'closed'
            )
        ),

    CONSTRAINT compliance_cases_reason_not_empty
        CHECK (length(trim(reason)) > 0),

    CONSTRAINT compliance_cases_resolution_check
        CHECK (
            (
                status IN ('open', 'investigating', 'escalated')
                AND resolved_at IS NULL
            )
            OR
            (
                status IN ('resolved', 'closed')
                AND resolved_at IS NOT NULL
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_compliance_cases_subject
    ON compliance_cases(subject_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_cases_status
    ON compliance_cases(status, priority, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_cases_type
    ON compliance_cases(case_type, created_at DESC);
