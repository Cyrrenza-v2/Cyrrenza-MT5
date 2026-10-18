-- Phase 2 operational data model.
-- No broker execution is implemented by this migration. All new tables are RLS protected;
-- direct authenticated writes are intentionally absent and must go through a reviewed server endpoint.
begin;

create table if not exists public.order_requests (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  client_id uuid references public.clients(id) on delete restrict,
  broker_account_id uuid not null references public.broker_accounts(id) on delete restrict,
  symbol text not null references public.instruments(symbol) on delete restrict,
  side text not null check (side in ('buy','sell')),
  volume numeric(20,8) not null check (volume > 0),
  order_type text not null default 'market' check (order_type in ('market','limit','stop','stop_limit')),
  requested_price numeric(20,10) check (requested_price is null or requested_price > 0),
  environment text not null default 'demo' check (environment = 'demo'),
  status text not null default 'pending_approval'
    check (status in ('pending_approval','approved','rejected','submitting','submitted','partially_filled','filled','cancelled','failed','outcome_unknown')),
  risk_result text not null default 'not_checked'
    check (risk_result in ('not_checked','passed','blocked','error')),
  risk_reasons jsonb not null default '[]'::jsonb check (jsonb_typeof(risk_reasons) = 'array'),
  requester_user_id uuid not null references auth.users(id) on delete restrict,
  provider_order_id text,
  provider_outcome jsonb not null default '{}'::jsonb,
  policy_version text,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  reconciled_at timestamptz,
  constraint order_requests_account_demo_only check (environment = 'demo')
);
create index if not exists order_requests_status_requested_at_idx on public.order_requests(status, requested_at desc);
create index if not exists order_requests_account_requested_at_idx on public.order_requests(broker_account_id, requested_at desc);

create table if not exists public.order_approvals (
  id uuid primary key default gen_random_uuid(),
  order_request_id uuid not null references public.order_requests(id) on delete restrict,
  decision text not null check (decision in ('approved','rejected')),
  approver_user_id uuid not null references auth.users(id) on delete restrict,
  reason text not null,
  risk_result text not null check (risk_result in ('passed','blocked','error')),
  policy_version text not null,
  decided_at timestamptz not null default now(),
  unique (order_request_id)
);
create index if not exists order_approvals_approver_decided_idx on public.order_approvals(approver_user_id, decided_at desc);

create or replace function public.prevent_order_self_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester uuid;
begin
  select requester_user_id into requester
  from public.order_requests
  where id = new.order_request_id
  for update;
  if requester is null then
    raise exception 'Order request does not exist';
  end if;
  if requester = new.approver_user_id then
    raise exception 'Requester cannot approve or reject their own order';
  end if;
  return new;
end;
$$;
revoke all on function public.prevent_order_self_approval() from public, anon, authenticated;
drop trigger if exists order_approvals_no_self_approval on public.order_approvals;
create trigger order_approvals_no_self_approval
before insert or update on public.order_approvals
for each row execute function public.prevent_order_self_approval();

create table if not exists public.broker_positions (
  id uuid primary key default gen_random_uuid(),
  broker_account_id uuid not null references public.broker_accounts(id) on delete restrict,
  provider_position_id text not null,
  symbol text not null references public.instruments(symbol) on delete restrict,
  side text not null check (side in ('buy','sell')),
  volume numeric(20,8) not null check (volume >= 0),
  open_price numeric(20,10) check (open_price is null or open_price > 0),
  current_price numeric(20,10) check (current_price is null or current_price > 0),
  unrealized_pnl numeric(20,8),
  currency char(3) not null default 'USD',
  environment text not null default 'demo' check (environment = 'demo'),
  provider_observed_at timestamptz not null,
  synced_at timestamptz not null default now(),
  reconciled_at timestamptz,
  raw_provider_data jsonb not null default '{}'::jsonb,
  unique (broker_account_id, provider_position_id)
);
create index if not exists broker_positions_account_symbol_idx on public.broker_positions(broker_account_id, symbol);

create table if not exists public.account_equity_snapshots (
  id bigint generated always as identity primary key,
  broker_account_id uuid not null references public.broker_accounts(id) on delete restrict,
  environment text not null default 'demo' check (environment = 'demo'),
  currency char(3) not null default 'USD',
  balance numeric(20,8) not null,
  equity numeric(20,8) not null,
  margin numeric(20,8),
  free_margin numeric(20,8),
  provider_observed_at timestamptz not null,
  synced_at timestamptz not null default now(),
  source text not null,
  unique (broker_account_id, provider_observed_at)
);
create index if not exists account_equity_snapshots_recent_idx on public.account_equity_snapshots(broker_account_id, provider_observed_at desc);

create table if not exists public.reconciliation_events (
  id bigint generated always as identity primary key,
  broker_account_id uuid references public.broker_accounts(id) on delete restrict,
  event_type text not null check (event_type in ('account_snapshot','position','order','quote','balance','manual_review')),
  status text not null check (status in ('matched','mismatch','missing_provider_record','missing_local_record','error','pending')),
  external_reference text,
  local_reference text,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete restrict
);
create index if not exists reconciliation_events_open_idx on public.reconciliation_events(status, detected_at desc) where resolved_at is null;

create table if not exists public.risk_policies (
  id uuid primary key default gen_random_uuid(),
  policy_key text not null unique,
  version text not null,
  enabled boolean not null default false,
  allowed_environment text not null default 'demo' check (allowed_environment = 'demo'),
  max_order_volume numeric(20,8) not null default 0 check (max_order_volume >= 0),
  max_open_positions integer not null default 0 check (max_open_positions >= 0),
  max_account_exposure numeric(20,8) not null default 0 check (max_account_exposure >= 0),
  max_quote_age_seconds integer not null default 60 check (max_quote_age_seconds between 1 and 300),
  require_independent_approver boolean not null default true,
  allowed_symbols text[] not null default '{}',
  updated_by uuid references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);

create table if not exists public.trading_controls (
  control_key text primary key check (control_key = 'global'),
  new_orders_enabled boolean not null default false,
  emergency_stop boolean not null default true,
  environment text not null default 'demo' check (environment = 'demo'),
  reason text not null default 'Execution remains disabled until provider and server workflow verification.',
  updated_by uuid references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);
insert into public.trading_controls(control_key, new_orders_enabled, emergency_stop, environment, reason)
values ('global', false, true, 'demo', 'Phase 2 starts with order submission disabled.')
on conflict (control_key) do nothing;

-- Admin read access only. All writes to operational state must be mediated by a
-- server-side function with explicit authorization, validation, audit logging and idempotency.
do $$
declare
  t text;
begin
  foreach t in array array[
    'order_requests','order_approvals','broker_positions','account_equity_snapshots',
    'reconciliation_events','risk_policies','trading_controls'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "active admin read %s" on public.%I', t, t);
    execute format(
      'create policy "active admin read %s" on public.%I for select to authenticated using (private.is_cyrrenza_admin())',
      t, t
    );
  end loop;
end $$;

grant select on public.order_requests, public.order_approvals, public.broker_positions,
  public.account_equity_snapshots, public.reconciliation_events, public.risk_policies,
  public.trading_controls to authenticated;
grant usage, select on sequence public.account_equity_snapshots_id_seq,
  public.reconciliation_events_id_seq to authenticated;

commit;
