-- =============================================================================
-- CleanOps 0006 — P&L by job date counts booked visits, like the old sheet
-- Owner decision (2026-10-17): the Monthly Profits view by cleaning date
-- includes scheduled, confirmed and in-progress visits as well as done ones,
-- so upcoming months read as a forecast. Cancelled and skipped visits are
-- excluded. Cleaner pay counts every assignment that is not declined or a
-- no-show. The cash-basis view (v_monthly_pnl) is unchanged.
-- =============================================================================

create or replace view v_monthly_pnl_by_job as
with months as (
  select distinct date_trunc('month', m)::date as month from (
    select scheduled_start at time zone 'America/New_York' as m from jobs
    where status in ('scheduled', 'confirmed', 'in_progress', 'done')
    union all select paid_at::timestamp from expenses
  ) x
),
jobs_m as (
  select date_trunc('month', j.scheduled_start at time zone 'America/New_York')::date as month,
         sum(j.charge_cents)                                   as charged_cents,
         sum(coalesce(p.fee_cents, 0))                          as fee_cents,
         sum(coalesce(a.pay_cents, 0))                          as provider_pay_cents
  from jobs j
  left join lateral (select sum(fee_cents) as fee_cents from payments where job_id = j.id) p on true
  left join lateral (
    select sum(pay_cents) as pay_cents from job_assignments
    where job_id = j.id and status not in ('declined', 'no_show')
  ) a on true
  where j.status in ('scheduled', 'confirmed', 'in_progress', 'done')
  group by 1
),
ex as (
  select date_trunc('month', paid_at)::date as month,
         sum(amount_cents) filter (where category <> 'ads') as overhead_cents,
         sum(amount_cents) filter (where category = 'ads')  as ad_cents
  from expenses group by 1
)
select
  m.month,
  coalesce(ex.overhead_cents, 0)        as overhead_expense_cents,
  coalesce(jm.provider_pay_cents, 0)    as provider_payment_cents,
  coalesce(jm.fee_cents, 0)             as stripe_fee_cents,
  coalesce(jm.charged_cents, 0)         as charged_cents,
  coalesce(ex.ad_cents, 0)              as ad_expense_cents,
  coalesce(jm.charged_cents, 0) - coalesce(jm.fee_cents, 0)
    - coalesce(jm.provider_pay_cents, 0) - coalesce(ex.overhead_cents, 0) - coalesce(ex.ad_cents, 0)
                                        as total_profit_cents,
  sum(coalesce(jm.charged_cents, 0) - coalesce(jm.fee_cents, 0)
    - coalesce(jm.provider_pay_cents, 0) - coalesce(ex.overhead_cents, 0) - coalesce(ex.ad_cents, 0))
    over (partition by date_trunc('year', m.month) order by m.month) as ytd_profit_cents
from months m
left join jobs_m jm on jm.month = m.month
left join ex      on ex.month = m.month
order by m.month;
