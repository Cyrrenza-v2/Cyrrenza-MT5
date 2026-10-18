# Phase 3 — Authorized Demo Adapter and Reconciliation

## Objective

Connect Cyrrenza MT5 to a broker-authorized **demo** MT5 environment through a provider-neutral server-side adapter, then prove account and trading-state reconciliation. This phase does not authorize live trading.

## Current verified baseline

- Supabase Edge Function `mt5-connectivity-check` is deployed with JWT verification.
- The function only performs a read-only health request. It does not implement the MT5 Manager API and cannot submit orders.
- The browser must never receive broker/Manager API credentials or the adapter bearer token.
- No authenticated broker demo connection is currently proven. Do not mark the integration healthy until the required checks pass against the actual authorized demo account.
- Keep live trading disabled and preserve the emergency stop until all Phase 3 acceptance gates are explicitly signed off.

## Required external prerequisite

Obtain the following from the broker or authorized MT5 integration provider through its secure onboarding channel:

1. Confirmation that the broker authorizes Cyrrenza to connect to the named MT5 demo server/account and confirmation of permitted API capabilities.
2. A supported Manager API or provider bridge/adapter and its documented authentication method.
3. A separately hosted HTTPS adapter health endpoint and bearer token for the existing health-check function.
4. A demo account/server identifier and a test window for controlled validation.
5. Written confirmation of account currency, leverage, margin model, symbol naming, and whether order placement is permitted in that demo environment.

Do not commit credentials, put secrets in frontend code, or send tokens in chat.

## Server-side secret configuration

Configure these Supabase Edge Function secrets only after the provider has issued them:

- `MT5_ADAPTER_HEALTH_URL` — HTTPS health endpoint; no credentials embedded in the URL, query string, or fragment.
- `MT5_ADAPTER_TOKEN` — dedicated bearer token for the health endpoint.

The adapter itself must keep broker/Manager API credentials in its own server-side secret store. Use distinct credentials for demo and live environments. Never reuse a demo token for live.

## Provider-neutral adapter contract

The adapter is a separate trusted server-side service. It must authenticate to the authorized demo server and expose versioned, authenticated endpoints for:

- `GET /health`: `connected`, `authenticated`, `platform: "MT5"`, `environment: "demo"`, provider/server identity (non-secret), check time, and a safe diagnostic code.
- `GET /v1/account`: account/server identity, currency, balance, equity, margin, free margin, leverage, and snapshot timestamp.
- `GET /v1/symbols`: broker symbol identifiers and trading specifications, including digits, contract size, volume limits/step, tick size/value, and trade status.
- `GET /v1/positions`: current positions with stable provider IDs, symbol, side, volume, open price, current price, profit, and update time.
- `GET /v1/orders` and `GET /v1/deals`: order/deal history with stable provider IDs, state, timestamps, requested and filled volume, prices, and rejection reasons where available.
- Controlled demo order operations only after the read-only gates pass: submit, query status, and cancel where supported. Every request must carry a unique idempotency key and a client correlation ID.

All responses must be schema-validated; use bounded timeouts, reject redirects, redact credentials, and return explicit unavailable/unauthorized/stale states rather than fabricated defaults. The browser must call authenticated Supabase Edge Functions, not the adapter directly.

## Reconciliation rules

- Treat the broker/MT5 server as the source of truth for broker account state and execution outcomes.
- Store snapshots with provider, server, environment, account reference, provider timestamp, and local observation timestamp.
- Do not infer a zero balance, zero positions, or successful reconciliation from an empty query, timeout, or missing data.
- Flag stale or incomplete snapshots; do not silently reuse stale values as current.
- Compare local mirrored positions/orders/deals to provider IDs and report missing, duplicate, mismatched, or out-of-order records.
- Never create a second order because a request timed out. Resolve the first request by its idempotency key and provider status before retrying.
- A submitted request is not an execution. Only a broker-confirmed execution/deal can be recorded as filled.
- Maintain append-only audit records for privileged actions and reconciliation exceptions.

## Phase 3 delivery gates

### Gate A — Authorized connectivity (read-only)
- Provider authorization and demo account/server identity documented.
- Health endpoint proves authenticated, connected, platform MT5, environment demo.
- Admin UI shows timestamp, source, environment, and clear failure reason.
- Missing secrets, bad token, network timeout, wrong environment, malformed JSON, and stale responses are tested.

### Gate B — Read-only account sync
- Account snapshot, symbols, positions, orders, and deals load from the actual demo server.
- Currency and symbol specifications are verified with the provider.
- Data freshness and reconciliation exceptions are visible in the admin portal.
- No sample/demo fixture data is presented as live broker data.

### Gate C — Controlled demo order lifecycle
- Only after Gates A and B pass: test one small permitted demo order, query its status, verify broker-confirmed fill/rejection, then close/cancel as supported.
- Test timeout, duplicate submission, partial fill, rejection, cancellation, and reconnect behavior.
- Verify the resulting provider positions/deals and local audit/reconciliation records.
- Keep requester/approver separation and admin approval controls where required.

### Gate D — Safety and sign-off
- Confirm RLS/authorization, secret redaction, idempotency, audit trails, emergency stop, and environment separation.
- Run a reconciliation report and resolve every unexplained mismatch.
- Obtain explicit operator approval of the evidence before considering any later live-trading review. Phase 3 itself does not turn live trading on.

## Acceptance evidence required

Record links or redacted evidence for provider authorization, successful health response, account snapshot, symbol specification, positions/orders/deals reconciliation, demo order lifecycle, failure-mode tests, and CI results. Do not mark a gate complete based only on a successful Cloudflare deployment or a public market-data feed.

## Current status

**Blocked on provider-issued authorized demo adapter details.** The repository can prepare and validate the contract, health checks, schema handling, and reconciliation tests, but it cannot honestly claim broker connectivity or test a real demo order until the external adapter and authorized demo account exist. Live trading remains disabled.
