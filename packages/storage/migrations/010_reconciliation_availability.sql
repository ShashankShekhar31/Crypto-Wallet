-- Preserve individual source availability in reconciliation records.
-- NULL amount means that the corresponding source was unavailable.

ALTER TABLE reconciliation_comparisons
    ADD COLUMN IF NOT EXISTS expected_observation_status TEXT,
    ADD COLUMN IF NOT EXISTS actual_observation_status TEXT;

UPDATE reconciliation_comparisons
SET
    expected_observation_status = 'available',
    actual_observation_status = 'available'
WHERE expected_observation_status IS NULL
   OR actual_observation_status IS NULL;

ALTER TABLE reconciliation_comparisons
    ALTER COLUMN expected_observation_status SET NOT NULL,
    ALTER COLUMN actual_observation_status SET NOT NULL;

ALTER TABLE reconciliation_comparisons
    ALTER COLUMN expected_amount DROP NOT NULL,
    ALTER COLUMN actual_amount DROP NOT NULL;

ALTER TABLE reconciliation_comparisons
    ADD CONSTRAINT reconciliation_expected_observation_status_check
        CHECK (
            expected_observation_status IN ('available', 'unavailable')
        ),
    ADD CONSTRAINT reconciliation_actual_observation_status_check
        CHECK (
            actual_observation_status IN ('available', 'unavailable')
        );

ALTER TABLE reconciliation_comparisons
    ADD CONSTRAINT reconciliation_expected_amount_availability_check
        CHECK (
            (
                expected_observation_status = 'available'
                AND expected_amount IS NOT NULL
                AND expected_amount >= 0
            )
            OR
            (
                expected_observation_status = 'unavailable'
                AND expected_amount IS NULL
            )
        ),
    ADD CONSTRAINT reconciliation_actual_amount_availability_check
        CHECK (
            (
                actual_observation_status = 'available'
                AND actual_amount IS NOT NULL
                AND actual_amount >= 0
            )
            OR
            (
                actual_observation_status = 'unavailable'
                AND actual_amount IS NULL
            )
        );