-- =============================================================================
-- CleanOps 0004 — "owed to cleaners" includes cancellation fees
-- DECISIONS.md: a cancelled visit with a fee marks the assignment
-- cancelled_paid; it must show up in what the owner owes and in 1099 totals
-- (payouts already do, since the fee flows through a payout).
-- =============================================================================

create or replace view v_provider_owed as
select
  pr.id                      as provider_id,
  pr.name                    as provider_name,
  pr.zelle_handle,
  count(ja.id)               as jobs_owed,
  coalesce(sum(ja.pay_cents), 0) as owed_cents,
  min(j.scheduled_start)     as oldest_job_at
from providers pr
join job_assignments ja
  on ja.provider_id = pr.id and ja.payout_id is null and ja.status in ('done', 'cancelled_paid')
join jobs j on j.id = ja.job_id
group by pr.id, pr.name, pr.zelle_handle;
