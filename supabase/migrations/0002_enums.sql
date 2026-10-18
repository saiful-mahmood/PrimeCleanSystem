-- =============================================================================
-- CleanOps 0002 — enum additions from docs/DECISIONS.md
-- Postgres refuses to use a new enum value in the same transaction that added
-- it, so these live in their own migration; 0003 uses them.
--  * Venmo as a charge method (10 rows in the old sheet)
--  * cancelled_paid assignment status (cleaner paid a cancellation fee)
-- =============================================================================

alter type charge_method     add value if not exists 'venmo';
alter type assignment_status add value if not exists 'cancelled_paid';
