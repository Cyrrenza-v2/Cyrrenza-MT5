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
