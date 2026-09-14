ALTER TABLE outbox_events
  ADD COLUMN processing_token UUID,
  ADD COLUMN processing_until TIMESTAMPTZ;

CREATE INDEX outbox_events_claim_idx
  ON outbox_events (available_at, processing_until, occurred_at, event_id)
  WHERE published_at IS NULL;