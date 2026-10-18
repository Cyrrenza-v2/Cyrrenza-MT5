# Cyrrenza MT5 Admin Operations Modules

## Scope of this change

This branch adds three admin modules to the existing static admin console:

- **Order Approval Queue** — pending/rejected/risk-blocked counts, approval history, requester/approver separation, risk-check expectations, broker-confirmed outcomes.
- **Accounts, Instruments & Positions** — account records from the existing authenticated API, enabled instrument counts, quote freshness, and explicit placeholders for provider-only equity and positions.
- **Security, Risk & Audit** — MFA/risk/kill-switch state, required security controls, known blockers, and searchable audit-event UI.

The existing **Overview**, **Integrations**, and **Audit & Security** pages remain in place. The integration monitoring module continues to show authenticated status and quote data.

## Verified API boundary

The current deployed `admin-api` was previously inspected as a JWT-protected read-only GET API. The frontend currently requests `status`, `clients`, `accounts`, `instruments`, and `quotes`. This branch does not assume that write endpoints or broker capabilities exist.

Consequently:

- Order requests, approvals, rejections, cancellation, risk configuration, and kill-switch operations are not enabled by this UI change.
- Order/approval history, positions, durable audit events, reconciliation errors, demo equity and MFA enforcement are displayed as unavailable/unverified until the backend provides authoritative resources.
- Quotes are counted as fresh only if their timestamp is within 60 seconds, bid/ask values are valid, and the stored record explicitly marks itself as live. Even then, the UI says the source still needs verification.
- Account records from Supabase are not treated as proof of a broker connection or proof that the account is a demo account.
- The UI does not fabricate positions, broker fills, approvals, equity, or audit records.

## Backend work required before operational use

1. Confirm and document broker-authorized demo access and the supported MT5 integration protocol.
2. Add server-side resources for approval requests, approval history, orders, positions, equity snapshots, reconciliation health, risk policy, kill-switch status and durable audit events.
3. Add transactional state transitions and enforce that a requester cannot approve their own request.
4. Enforce a demo-account allowlist, risk limits, quote freshness, idempotency and reconciliation on the server.
5. Enforce MFA for privileged users and verify Supabase RLS and authorization in authenticated tests.
6. Add integration tests for duplicate submission, broker timeout/outcome unknown, rejected orders, stale quotes, disabled symbols, unauthorized approval, and kill-switch behavior.
7. Test the deployed page in desktop and Android browsers after the branch is reviewed and merged.

## Safety statement

This is a monitoring/administration UI enhancement only. It does not connect to an MT5 broker, enable trading, or establish that security controls have been enforced. Real-money execution remains out of scope and disabled.
