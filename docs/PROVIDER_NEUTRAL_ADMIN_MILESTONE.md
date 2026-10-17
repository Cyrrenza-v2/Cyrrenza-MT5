# Cyrrenza MT5 — Provider-Neutral Adapter and CEO Admin Monitoring

## Scope and decisions
- Integration strategy: provider-neutral adapter; do not hard-code the application to one broker or feed.
- First milestone: complete the CEO Admin dashboard and integration monitoring.
- Keep the existing Cloudflare Pages URL: https://cyrrenza-mt5-admin.pages.dev. Custom domain is explicitly deferred.
- Live trading, live order execution, deposits, and withdrawals stay disabled.
- Until an external source is verified, show market data as unavailable; never generate fake quotes or label demo data as live.

## Architecture
Dashboard (Cloudflare Pages) → authenticated Supabase Edge Function → provider-neutral adapter → optional broker/feed connector → Supabase storage.
The browser must never receive provider API secrets. The adapter owns provider-specific authentication, timeouts, rate limits, retries, normalization and sanitized errors. The application depends only on stable internal types.

## Adapter contract (read-only for milestone 1)
- `healthcheck()`: provider connectivity, credential/configuration state, latency and check timestamp.
- `listAccounts()`: authorized account identifiers and demo/live classification; never return passwords/tokens.
- `listInstruments()`: provider symbols, display name, asset class and trading availability.
- `getQuotes(symbols)`: bid, ask, source timestamp, received timestamp, source/provider, environment and freshness.
- `getSyncStatus()`: last attempt, last successful sync, last error (sanitized), retry state.
- No `placeOrder`, `modifyOrder`, `closePosition`, deposit, or withdrawal methods in milestone 1.

Suggested internal types:
- ProviderConfig: providerKey, environment ('demo' | 'read_only'), enabled.
- ProviderHealth: status ('not_configured' | 'healthy' | 'degraded' | 'offline'), checkedAt, latencyMs?, message.
- NormalizedQuote: symbol, bid, ask, providerTimestamp, receivedAt, providerKey, environment, isLive=false.
- SyncResult: attemptedAt, succeededAt?, recordsRead, recordsWritten, errorCode?, sanitizedMessage?.

## CEO Admin dashboard work
1. Keep Supabase Auth as the identity source and enforce active role checks server-side on every private API request.
2. Create a clear summary strip: Admin access, provider status, market-data freshness, last deployment, and LIVE TRADING DISABLED.
3. Add Integration Monitoring rows for Supabase/Auth, GitHub→Cloudflare Pages deployment, broker adapter, market-data source, and MT5 Manager API (if later approved). Each row shows state, last checked, last successful sync, and a sanitized actionable message.
4. Connect Clients, Broker Accounts, Instruments, Quotes and Integration Status panels to the authenticated `admin-api`; add loading, empty, stale, forbidden and failure states.
5. Do not treat “deployment succeeded” as proof that the app, auth, database policies or external provider works.
6. Distinguish catalogue entries from provider-verified instruments. Leave unverified instruments disabled.
7. Ensure audit events are durable server-side records; don't represent local UI events as audit logs.
8. Make refresh/retry buttons perform a real authenticated request and show its result.
9. Keep the current Pages URL; no DNS or custom-domain changes in this milestone.

## Provider configuration and quote validation
- Keep connector disabled until provider, environment, credentials and permission are explicitly configured.
- Store tokens/passwords only in backend secrets. Do not commit them, log them, or expose them in frontend variables.
- Start with a demo or read-only connection; ask provider for written authorization and market-data display rights.
- Normalize symbols through the provider's instrument catalogue; don't assume symbols have identical names across brokers.
- Reject non-finite/negative prices, bid greater than ask, missing/invalid timestamps, unknown symbols and stale quotes.
- Store provider source and timestamps. Demo quotes must have `is_live=false`; never infer “live” from recency alone.
- Use timeouts, bounded retries/backoff, rate limits and sanitized error responses.

## Acceptance criteria
- Anonymous and unauthorized roles cannot access dashboard data.
- Active admin can view integration status, clients, accounts, instruments and quotes without secrets in responses.
- All panels correctly show empty data when there are no clients/accounts/quotes; no fabricated operational figures.
- A broken provider shows a clear degraded/offline state, not fake healthy status.
- Quotes are accepted only when structurally valid and fresh; provider source and timestamps are preserved.
- Last attempt, last success and sanitized failure reason are visible.
- There is no order-placement route or UI action in this milestone.
- Automated checks and a deployed smoke test confirm the expected commit is serving.
- Live trading, deposits, withdrawals and live quote flags remain disabled.

## Current connected-resource baseline (17 October 2026)
- Supabase project: `mvxhpddjtctpvrurqnpg`.
- Existing Edge Function `admin-api` is active with JWT verification and role checks. It supports GET-only resources: status, quotes, clients, accounts and instruments. It returns `liveTradingEnabled: false`.
- Public tables include admin_profiles, clients, broker_accounts, instruments, market_quotes, integration_status and audit_events; RLS is enabled on these tables.
- Client and broker-account tables are currently empty; 13 catalogue instruments are disabled; market_quotes is empty. UI must represent this honestly.
- `integration_status` includes `direct_broker_api`, `metaapi_market_data`, `mt5_manager_api`, `market_data`, `github_deployment` and `ceo_admin_monitoring`.
- Cloudflare Pages project `cyrrenza-mt5-admin` builds from GitHub `main`. The docs commit was successfully deployed, but this proves only that the static Pages build/deploy succeeded.
- Supabase security advisor reports leaked-password protection is disabled; enable it in Auth security settings.
- No broker/feed credentials are configured, so no real provider health or quotes have been verified.
