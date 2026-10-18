# Phase 2 — Operations backend foundation

## Scope

This migration introduces durable tables for order requests and independent approvals, broker positions, demo-account equity snapshots, reconciliation events, risk policies, and global trading controls.

## Safety defaults

- Order environment is constrained to `demo` for the Phase 2 schema.
- Global control is seeded fail-closed: `new_orders_enabled=false`, `emergency_stop=true`.
- RLS is enabled on all new tables. Authenticated admins may read; no direct authenticated INSERT/UPDATE/DELETE policies are created.
- Order approval rows have a database trigger that rejects a decision by the same user who requested the order.
- All order writes, state transitions, risk evaluation, provider synchronization, control changes and audit writes must be implemented through reviewed server-side functions with explicit authorization and idempotency.
- No broker adapter, order submission endpoint, real-money operation, or successful payment/trade is claimed by this schema.

## Apply order

1. Review this migration and the paired smoke-test SQL.
2. Merge the Phase 2 PR only after CI passes.
3. Apply migration `20261018130000_phase_2_operations_backend` to Supabase project `mvxhpddjtctpvrurqnpg` using the migration workflow.
4. Run `supabase/tests/phase-2-operations-smoke.sql` in the SQL Editor and inspect every result. The last query should return no rows.
5. Verify the admin UI continues to show provider data as unavailable until a verified adapter is configured.

## Follow-on work

- Add server-side endpoints for reading these resources and controlled state transitions.
- Add a provider-neutral MT5 demo adapter after broker-authorized demo credentials/protocol are confirmed.
- Add integration tests for unauthorized requests, self-approval, duplicate idempotency keys, stale quotes, disabled symbols, provider timeouts and reconciliation mismatches.
- Verify MFA policy and the project's leaked-password protection setting separately; this migration does not change Auth settings.
