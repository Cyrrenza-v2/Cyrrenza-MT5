# Cyrrenza MT5 — MetaApi demo integration

## Current state
- Provider selected: MetaApi.
- Environment: demo-only.
- Live quotes: disabled until provider connection and quote validation succeed.
- Trade execution: disabled.
- Existing Supabase tables: `instruments`, `market_quotes`, `broker_accounts`, `integration_status`, `audit_events`.
- Current admin URL: https://cyrrenza-mt5-admin.pages.dev

## Prerequisites (operator action)
1. Create/verify a MetaApi account at https://app.metaapi.cloud/ and review its current pricing.
2. Create or obtain an MT5 **demo** account from a broker. Record its exact server name and login.
3. Generate a MetaApi API token. Do not commit it, put it in frontend JavaScript, or send it in chat.
4. Add the token as a server-side secret named `METAAPI_TOKEN` in the chosen backend runtime. Keep it out of Cloudflare Pages public build variables.
5. Provide the MT5 demo account credentials only to the authorized MetaApi account connection flow; use a demo account, not a live account.

## Connection acceptance checks
- MetaApi reports the demo account deployed and connected to its broker.
- Read-only account synchronization completes.
- Subscribe to at least EURUSD (and only symbols supported by the broker).
- Bid/ask values are finite, non-negative, bid <= ask when both exist, and timestamps are recent.
- Persist quote records to `market_quotes` with `source='metaapi' ` and `is_live=false` during demo testing.
- Mark `instruments.enabled=true` only for symbols actually returned by the provider and accepted for testing.
- Update `integration_status` with last check time and sanitized error details; never store tokens/passwords.
- Confirm the admin UI shows provider state and quotes from Supabase, not hard-coded sample values.

## Security and safety
- Keep MetaApi credentials server-side in a secret manager.
- Use an account-scoped token where supported and least privilege.
- Enforce admin authorization in the Edge Function and retain JWT verification.
- This milestone is read-only. Do not expose order-placement methods in the adapter.
- Keep `live_quotes_enabled=false` and `trade_execution_enabled=false` until separate review/approval.
- Do not label demo or delayed quotes as live market data.
- Before any production market-data use, review the provider's terms and the broker's market-data licensing/redistribution permissions.

## Next implementation stage
Implement a server-side Supabase Edge Function or protected integration worker that calls the MetaApi REST API, verifies account state, subscribes/polls quotes, and writes validated data to Supabase. Configure the secret first, then deploy and test. The browser must call the authenticated backend only; it must never call MetaApi with a private token.
