-- Phase 2 schema/security smoke tests.
-- Run in Supabase SQL Editor after applying the paired migration.
-- This file is intentionally read-only: it reports invariant failures as rows.
with expected(table_name) as (
  values ('order_requests'),('order_approvals'),('broker_positions'),
         ('account_equity_snapshots'),('reconciliation_events'),
         ('risk_policies'),('trading_controls')
),
checks as (
  select e.table_name,
         exists (
           select 1 from information_schema.tables t
           where t.table_schema='public' and t.table_name=e.table_name
         ) as table_exists,
         coalesce((
           select c.relrowsecurity
           from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='public' and c.relname=e.table_name
         ), false) as rls_enabled
  from expected e
)
select table_name, table_exists, rls_enabled,
       case when table_exists and rls_enabled then 'PASS' else 'FAIL' end as result
from checks
order by table_name;

-- Confirm the global control remains fail-closed.
select control_key, new_orders_enabled, emergency_stop, environment,
       case when new_orders_enabled=false and emergency_stop=true and environment='demo'
            then 'PASS' else 'FAIL' end as fail_closed_result
from public.trading_controls
where control_key='global';

-- Verify authenticated users have no direct INSERT/UPDATE/DELETE policies on new tables.
select tablename, cmd, policyname
from pg_policies
where schemaname='public'
  and tablename in ('order_requests','order_approvals','broker_positions',
    'account_equity_snapshots','reconciliation_events','risk_policies','trading_controls')
  and cmd in ('INSERT','UPDATE','DELETE')
order by tablename, cmd;


-- Phase 2 safety guards must exist before any provider adapter is enabled.
with required_triggers(trigger_name, table_name) as (
  values
    ('order_requests_demo_account_guard','order_requests'),
    ('order_requests_status_transition_guard','order_requests'),
    ('order_requests_provider_payload_guard','order_requests'),
    ('broker_positions_provider_payload_guard','broker_positions')
)
select r.trigger_name, r.table_name,
       exists (
         select 1 from information_schema.triggers t
         where t.trigger_schema='public'
           and t.event_object_schema='public'
           and t.event_object_table=r.table_name
           and t.trigger_name=r.trigger_name
       ) as trigger_exists,
       case when exists (
         select 1 from information_schema.triggers t
         where t.trigger_schema='public'
           and t.event_object_schema='public'
           and t.event_object_table=r.table_name
           and t.trigger_name=r.trigger_name
       ) then 'PASS' else 'FAIL' end as result
from required_triggers r
order by r.table_name, r.trigger_name;

select
  to_regprocedure('public.enforce_demo_order_account()') is not null as demo_account_guard_exists,
  to_regprocedure('public.enforce_order_status_transition()') is not null as status_guard_exists,
  to_regprocedure('public.jsonb_has_sensitive_key(jsonb)') is not null as credential_key_scanner_exists,
  to_regprocedure('public.guard_provider_payloads()') is not null as payload_guard_exists;
