CREATE TABLE IF NOT EXISTS outbox_events (
  event_id UUID PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_version BIGINT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT outbox_events_event_version_positive
    CHECK (event_version > 0),

  CONSTRAINT outbox_events_attempts_non_negative
    CHECK (attempts >= 0),

  CONSTRAINT outbox_events_published_after_created
    CHECK (published_at IS NULL OR published_at >= created_at)
);

CREATE INDEX IF NOT EXISTS outbox_events_unpublished_idx
  ON outbox_events (available_at, occurred_at, event_id)
  WHERE published_at IS NULL;

CREATE INDEX IF NOT EXISTS outbox_events_aggregate_idx
  ON outbox_events (aggregate_type, aggregate_id, occurred_at);