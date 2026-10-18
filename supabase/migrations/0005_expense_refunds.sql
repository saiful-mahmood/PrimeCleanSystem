-- =============================================================================
-- CleanOps 0005 — expenses may be negative (refunds)
-- The old sheet has an OpenPhone refund of -155.53; a refund is simply a
-- negative expense and should reduce overhead in the P&L.
-- =============================================================================

alter table expenses drop constraint if exists expenses_amount_cents_check;
