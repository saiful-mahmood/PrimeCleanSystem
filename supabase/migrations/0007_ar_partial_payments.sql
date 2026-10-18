-- =============================================================================
-- CleanOps 0007 — "owed by clients" handles partial payments
-- v_ar_aging counted a done visit only while it had no payment at all, so a
-- visit paid in part vanished from AR. It now reports what is still
-- outstanding (charge minus payments) for visits, and amount minus payments
-- for sent invoices, and only while that is above zero.
-- =============================================================================

create or replace view v_ar_aging as
select
  'invoice'::text            as kind,
  i.id                       as ref_id,
  i.client_id,
  c.name                     as client_name,
  i.amount_cents - coalesce((select sum(p.amount_cents) from payments p where p.invoice_id = i.id), 0) as amount_cents,
  i.sent_at::date            as since,
  (current_date - i.sent_at::date) as days_outstanding
from invoices i join clients c on c.id = i.client_id
where i.status = 'sent'
  and i.amount_cents - coalesce((select sum(p.amount_cents) from payments p where p.invoice_id = i.id), 0) > 0
union all
select
  'job',
  j.id,
  j.client_id,
  c.name,
  j.charge_cents - coalesce((select sum(p.amount_cents) from payments p where p.job_id = j.id), 0),
  (j.scheduled_start at time zone 'America/New_York')::date,
  (current_date - (j.scheduled_start at time zone 'America/New_York')::date)
from jobs j join clients c on c.id = j.client_id
where j.status = 'done'
  and not exists (select 1 from invoice_jobs ij where ij.job_id = j.id)
  and j.charge_cents - coalesce((select sum(p.amount_cents) from payments p where p.job_id = j.id), 0) > 0;
