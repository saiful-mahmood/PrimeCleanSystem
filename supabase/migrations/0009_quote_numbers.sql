-- =============================================================================
-- CleanOps 0009 — quotes (estimates) built on proposals / proposal_versions
--  * quote_number: the human-facing unique id, e.g. PCC-2026-0007
--  * recipient details live in each version's `fields` JSON (client block)
-- =============================================================================

alter table proposals add column if not exists quote_number text unique;
create index if not exists proposals_client_idx on proposals(client_id);
create index if not exists proposal_versions_proposal_idx on proposal_versions(proposal_id, version_no desc);
