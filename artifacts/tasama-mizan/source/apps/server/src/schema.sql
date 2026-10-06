-- Tasama Mizan — PostgreSQL schema. One table per domain entity, typed
-- columns for the fields people will query, JSONB for nested arrays.
-- The seed writes the deterministic synthetic world; every action is a
-- transaction that upserts the rows it changed. Reset truncates and re-seeds.
create schema if not exists mizan;
set search_path to mizan;

create table if not exists world_meta (
  key text primary key,
  value jsonb not null
);

create table if not exists clients (
  id text primary key, position integer not null, code text not null, name text not null, short text not null, segment text not null, pif boolean not null,
  kam text not null, delivery_lead text not null, vat_no text, payment_terms_days integer not null, currency text not null, channel text not null
);

create table if not exists contracts (
  id text primary key, position integer not null, client_id text not null references clients(id), type text not null, status text not null,
  start_date date not null, end_date date not null, total_value numeric(16,2), payment_terms_days integer not null,
  coc_required boolean not null, rate_card_version text not null, source text not null
);

create table if not exists purchase_orders (
  id text primary key, position integer not null, client_id text not null references clients(id), contract_id text not null references contracts(id), proposal_id text not null,
  po_date date not null, start_date date not null, end_date date not null, value numeric(16,2) not null, currency text not null, status text not null,
  schedule_confirmed boolean not null
);

create table if not exists po_lines (
  id text primary key, po_id text not null references purchase_orders(id), position integer not null, activity text not null, business_line text not null, service_tag text not null,
  pricing_model text not null, unit text not null, rate numeric(16,2) not null, qty numeric(16,2) not null, included_volume numeric(16,2), unit_price numeric(16,2),
  markup_pct numeric(8,2), milestones jsonb, start_date date not null, end_date date not null, vendor_po_id text, match_flags jsonb not null default '[]'
);

create table if not exists billing_events (
  id text primary key, position integer not null, line_id text not null references po_lines(id), po_id text not null, client_id text not null, period text not null, label text not null,
  due_date date not null, expected_amount numeric(16,2) not null, currency text not null, evidence_required jsonb not null, evidence jsonb not null,
  coc text not null, coc_sent_on date, invoice_id text, note text, no_po_cover boolean
);
create index if not exists billing_events_period on billing_events(period);
create index if not exists billing_events_client on billing_events(client_id);

create table if not exists invoices (
  id text primary key, position integer not null, client_id text not null references clients(id), po_id text not null, event_ids jsonb not null, invoice_date date not null, due_date date not null,
  currency text not null, net numeric(16,2) not null, vat numeric(16,2) not null, gross numeric(16,2) not null, status text not null, zatca text not null,
  zatca_reason text, erp_ref text, credit_note_of text, billed_rate numeric(16,2), description text not null
);
create index if not exists invoices_client on invoices(client_id);
create index if not exists invoices_status on invoices(status);

create table if not exists bank_accounts (
  id text primary key, position integer not null, bank text not null, label text not null, iban text not null, currency text not null,
  opening_ledger numeric(16,2) not null, opening_statement numeric(16,2) not null, reconciled_through date not null, signed_off boolean not null
);

create table if not exists bank_lines (
  id text primary key, position integer not null, account_id text not null references bank_accounts(id), line_date date not null, description text not null, raw_description text not null,
  amount numeric(16,2) not null, direction text not null, type text not null, reference text, matched_ledger_id text, receipt_id text, source text not null
);
create index if not exists bank_lines_account on bank_lines(account_id, line_date);

create table if not exists ledger_entries (
  id text primary key, position integer not null, account_id text not null references bank_accounts(id), entry_date date not null, kind text not null, description text not null,
  amount numeric(16,2) not null, reference text, matched_bank_line_id text
);

create table if not exists cash_receipts (
  id text primary key, position integer not null, bank_line_id text not null references bank_lines(id), client_id text, invoice_ids jsonb not null, amount numeric(16,2) not null,
  method text not null, confidence numeric(5,3) not null, status text not null, note text, shortfall numeric(16,2)
);

create table if not exists vendor_pos (
  id text primary key, position integer not null, vendor text not null, client_po_line_id text not null, value numeric(16,2) not null, cost_category text not null, consumed numeric(16,2) not null
);

create table if not exists vendor_invoices (
  id text primary key, position integer not null, vendor_key text not null, vendor_name text not null, invoice_ref text not null, issue_date date not null, due_date date not null,
  currency text not null, net numeric(16,2) not null, vat numeric(16,2) not null, total numeric(16,2) not null, vendor_po_id text, client_po_line_id text,
  match_status text not null, match_note text, line_items jsonb not null, source text not null, cognidocs_job_id text
);

create table if not exists budget (
  id text primary key, position integer not null, business_line text not null, month integer not null, budget numeric(16,2) not null, target numeric(16,2) not null, forecast numeric(16,2) not null
);

create table if not exists variance_drivers (
  id text primary key, position integer not null, business_line text not null, kind text not null, amount numeric(16,2) not null, explanation text not null, provenance text not null
);

create table if not exists opportunities (
  id text primary key, position integer not null, client_id text not null references clients(id), name text not null, business_line text not null, stage text not null,
  amount numeric(16,2) not null, recurring boolean not null, probability numeric(5,3) not null, expected_start date not null, term_months integer not null, owner text not null, note text not null
);

create table if not exists pipeline (
  id text primary key, position integer not null, business_line text not null, month integer not null, weighted numeric(16,2) not null, label text not null
);

create table if not exists close_items (
  id text primary key, position integer not null, workstream text not null, title text not null, owner text not null, agent_id text, due_day integer not null,
  status text not null, blocker text, evidence text, derived_from text
);

create table if not exists journals (
  id text primary key, position integer not null, kind text not null, description text not null, lines jsonb not null, proposed_by text not null,
  status text not null, period text not null, erp_ref text
);

create table if not exists findings (
  id text primary key, position integer not null, agent_id text not null, kind text not null, client_id text not null, amount numeric(16,2) not null,
  summary text not null, detail text not null, record_ref text not null, acknowledged boolean not null, resolved_by text
);

create table if not exists dunning (
  id text primary key, position integer not null, invoice_id text not null, client_id text not null, stage text not null, proposed_stage text not null,
  draft text not null, status text not null, promise_to_pay text, dispute text
);

create table if not exists parse_jobs (
  id text primary key, position integer not null, declared_type text not null, detected_type text, status text not null, file_name text not null, mime_type text,
  file_size_bytes integer, started_at timestamptz, parser_path text, confidence integer, error text, ai_prompt_tokens integer, ai_completion_tokens integer,
  ai_cost_amount_10k integer, sandbox boolean not null, result jsonb, created_at timestamptz not null, completed_at timestamptz, mode text not null, routed_to text
);

create table if not exists trail (
  id text primary key, position integer not null, at timestamptz not null, actor jsonb not null, kind text not null, autonomy text, summary text not null,
  detail text, record_ref text, override jsonb
);
create index if not exists trail_record on trail(record_ref);

create table if not exists expenses (
  id text primary key, position integer not null, client_id text not null, description text not null, amount numeric(16,2) not null, expense_date date not null,
  status text not null, job_id text
);
