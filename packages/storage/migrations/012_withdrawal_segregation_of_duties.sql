ALTER TABLE exchange_withdrawals
    ADD COLUMN IF NOT EXISTS requested_by TEXT,
    ADD COLUMN IF NOT EXISTS approved_by TEXT;

UPDATE exchange_withdrawals
SET requested_by = 'legacy-system'
WHERE requested_by IS NULL;

ALTER TABLE exchange_withdrawals
    ALTER COLUMN requested_by SET NOT NULL;

ALTER TABLE exchange_withdrawals
    ADD CONSTRAINT exchange_withdrawals_requested_by_not_empty
        CHECK (length(trim(requested_by)) > 0);

ALTER TABLE exchange_withdrawals
    ADD CONSTRAINT exchange_withdrawals_approved_by_not_empty
        CHECK (
            approved_by IS NULL
            OR length(trim(approved_by)) > 0
        );

ALTER TABLE exchange_withdrawals
    ADD CONSTRAINT exchange_withdrawals_approver_differs_from_requester
        CHECK (
            approved_by IS NULL
            OR approved_by <> requested_by
        );

ALTER TABLE exchange_withdrawals
    ADD CONSTRAINT exchange_withdrawals_approval_actor_check
        CHECK (
            (
                status = 'requested'
                AND approved_by IS NULL
            )
            OR
            (
                status IN (
                    'approved',
                    'rejected',
                    'submitted',
                    'confirmed',
                    'failed'
                )
                AND approved_by IS NOT NULL
            )
        );