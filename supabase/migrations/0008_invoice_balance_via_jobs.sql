-- =============================================================================
-- CleanOps 0008 — an invoice is settled by payments on its visits too
-- Payments recorded on a visit (job_id) that belongs to an invoice must
-- reduce that invoice's balance, otherwise paying from the calendar leaves
-- the invoice "owed" forever.
-- =============================================================================

create or replace function invoice_paid_cents(inv_id uuid) returns bigint
language sql stable as $$
  select coalesce(sum(p.amount_cents), 0)
  from payments p
  where p.invoice_id = inv_id
     or (p.invoice_id is null and p.job_id in (select ij.job_id from invoice_jobs ij where ij.invoice_id = inv_id));
$$;

create or replace view v_ar_aging as
select
  'invoice'::text            as kind,
  i.id                       as ref_id,
  i.client_id,
  c.name                     as client_name,
  (i.amount_cents - invoice_paid_cents(i.id))::integer as amount_cents,
  i.sent_at::date            as since,
  (current_date - i.sent_at::date) as days_outstanding
from invoices i join clients c on c.id = i.client_id
where i.status = 'sent'
  and i.amount_cents - invoice_paid_cents(i.id) > 0
union all
select
  'job',
  j.id,
  j.client_id,
  c.name,
  (j.charge_cents - coalesce((select sum(p.amount_cents) from payments p where p.job_id = j.id), 0))::integer,
  (j.scheduled_start at time zone 'America/New_York')::date,
  (current_date - (j.scheduled_start at time zone 'America/New_York')::date)
from jobs j join clients c on c.id = j.client_id
where j.status = 'done'
  and not exists (select 1 from invoice_jobs ij where ij.job_id = j.id)
  and j.charge_cents - coalesce((select sum(p.amount_cents) from payments p where p.job_id = j.id), 0) > 0;

-- Catch up invoices already covered by payments recorded on their visits.
update invoices i
set status = 'paid', paid_at = coalesce(i.paid_at, now())
where i.status = 'sent' and invoice_paid_cents(i.id) >= i.amount_cents;
