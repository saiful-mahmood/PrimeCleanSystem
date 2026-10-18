-- =============================================================================
-- CleanOps 0003 — changes from docs/DECISIONS.md (Session 0, 2026-10-17)
-- Depends on the enum values added in 0002.
--  * v_monthly_pnl_by_job: the old Monthly Profits tab is by cleaning date
--    and counts the charged amount whether or not the client has paid
--  * Service types that match what the business actually sells
--  * Business name
-- =============================================================================

-- -----------------------------------------------------------------------------
-- P&L by job date (default view on the P&L screen; matches the old tab)
-- -----------------------------------------------------------------------------
create view v_monthly_pnl_by_job as
with months as (
  select distinct date_trunc('month', m)::date as month from (
    select scheduled_start at time zone 'America/New_York' as m from jobs where status = 'done'
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
    where job_id = j.id and status in ('done', 'cancelled_paid')
  ) a on true
  where j.status = 'done'
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

-- -----------------------------------------------------------------------------
-- Service types: rename the generic seeds, add what the sheet shows
-- -----------------------------------------------------------------------------
update service_types set name = 'Regular Cleaning'           where name = 'Standard';
update service_types set name = 'Deep Cleaning'              where name = 'Deep';
update service_types set name = 'Move-Out Cleaning'          where name = 'Move-in/Move-out';
update service_types set name = 'Post-Construction Cleaning' where name = 'Post-construction';
update service_types set name = 'Commercial Cleaning'        where name = 'Commercial';

insert into service_types (name, default_duration_min) values
  ('Home Cleaning', 150),
  ('Event Cleaning', 240),
  ('Event Support', 240),
  ('Carpet Cleaning', 120),
  ('Steam Cleaning', 120),
  ('Lawn Mowing', 60),
  ('Spring Cleanup', 180),
  ('Snow Plowing', 60),
  ('Landscaping / Construction', 240)
on conflict (name) do nothing;

update settings set value = '"Prime Clean Care"', updated_at = now() where key = 'business_name';
