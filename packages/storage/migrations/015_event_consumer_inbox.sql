CREATE TABLE consumer_inbox_events (
  event_id UUID NOT NULL,
  consumer_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_version BIGINT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,

  PRIMARY KEY (event_id, consumer_name),

  CONSTRAINT consumer_inbox_event_version_positive
    CHECK (event_version > 0),

  CONSTRAINT consumer_inbox_attempts_non_negative
    CHECK (attempts >= 0),

  CONSTRAINT consumer_inbox_processed_after_received
    CHECK (processed_at IS NULL OR processed_at >= received_at)
);

CREATE INDEX consumer_inbox_unprocessed_idx
  ON consumer_inbox_events (consumer_name, received_at, event_id)
  WHERE processed_at IS NULL;

CREATE TABLE dead_letter_events (
  event_id UUID NOT NULL,
  consumer_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_version BIGINT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts INTEGER NOT NULL,
  last_error TEXT NOT NULL,

  PRIMARY KEY (event_id, consumer_name),

  CONSTRAINT dead_letter_event_version_positive
    CHECK (event_version > 0),

  CONSTRAINT dead_letter_attempts_positive
    CHECK (attempts > 0)
);

CREATE INDEX dead_letter_events_failed_idx
  ON dead_letter_events (failed_at DESC);

CREATE INDEX dead_letter_events_consumer_idx
  ON dead_letter_events (consumer_name, failed_at DESC);