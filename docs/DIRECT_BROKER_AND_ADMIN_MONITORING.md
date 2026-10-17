# Cyrrenza MT5 — Direct Broker API and CEO Admin Monitoring Plan

## Decisions
- Integration approach: direct broker API / broker-authorized MT5 integration.
- First milestone: finish CEO Admin dashboard and integration monitoring.
- Public URL remains https://cyrrenza-mt5-admin.pages.dev.
- Live trading, live order execution, deposits, and withdrawals remain disabled.
- First external integration tests must use demo account credentials and demo funds only.

## Broker selection recommendation
Do not choose a broker solely from spreads, marketing claims, or the fact it supports MT5. The direct API route is appropriate only if the broker is willing and authorized to provide the integration access this product needs.

### Shortlist to validate
1. **Pepperstone** — candidate for a UK-facing MT5 demo pilot; confirm which legal entity would onboard the business, UK regulatory status, demo server availability, and whether it will provide an approved API/Manager API or other documented integration.
2. **IC Markets (UK/EU entity only if eligible)** — candidate for MT5 demo testing; confirm the exact legal entity, client-country eligibility, and direct API/Manager API access. Do not assume the global entity's terms apply to UK users.
3. **Trading.com UK** — candidate to investigate if UK-regulated onboarding is important; verify MT5 availability for the intended entity and ask whether external integration/API access is supported.

These are research candidates, not endorsements and not confirmed integrations. Verify the exact legal entity and permissions before committing. MetaTrader's official broker directory is a starting point, not proof that a broker exposes an API to this project: https://www.metatrader5.com/en/find-broker

### Broker due-diligence questions
- Can you issue an MT5 demo account and disclose its exact server name?
- Do you permit a third-party admin dashboard to access account status, symbols, quotes, history and balances?
- Is there a supported documented REST/WebSocket API, Manager API, or official bridge? What license/contract is required?
- Are credentials restricted to demo/read-only access? Can order placement be disabled at the broker/API permission level?
- What are the market-data display/redistribution terms, rate limits, IP allowlists, SLA, support contacts, and costs?
- Which regulated legal entity will contract with the business and which countries may it serve?

**Selection gate:** proceed only after written confirmation of demo access, API permission, market-data rights, supported symbols, and the correct contracting entity. If no broker provides a suitable documented direct API, revisit MetaApi as a separate option rather than scraping terminal traffic or using an unsupported bridge.

## Milestone 1 — finish CEO Admin dashboard
1. Use Supabase Auth and the existing server-side role gate for all private data.
2. Remove misleading placeholder broker/market figures from views presented as operational; keep fictional sample rows clearly labelled demo.
3. Connect the dashboard to the existing authenticated `admin-api` resources: status, clients, accounts, instruments and quotes.
4. Add an integration-monitoring panel for Supabase, GitHub/Cloudflare deployment, broker API, market data, and MT5 Manager API. Show status, last checked time, last successful sync, and a sanitized error message.
5. Add explicit environment banners: `DEMO ONLY`, `LIVE TRADING DISABLED`, `NO VERIFIED LIVE FEED` until each claim is independently validated.
6. Use server-side audit events for privileged actions; don't represent page-memory events as durable audit logs.
7. Add retry/refresh controls that actually call the authenticated backend, with loading, empty, stale, and error states.
8. Keep the existing Cloudflare Pages domain and verify the deployed commit after each GitHub push.

## Milestone 2 — broker API adapter (read-only)
- Store broker credentials only as backend secrets; never in HTML, JavaScript bundles, Git history, or chat.
- Add a provider-neutral adapter interface for health, account status, symbol catalogue, quote retrieval, and sync timestamp.
- Implement only the broker's documented, authorized endpoints.
- Validate symbols against the broker's returned catalogue. Keep unsupported catalogue placeholders disabled.
- Validate quote numeric fields, bid/ask ordering, timestamps, source identity, and freshness before persistence.
- Persist demo quotes with `source='broker_demo'` and `is_live=false`; don't mislabel them as live.
- Update `integration_status` with sanitized diagnostics. Never log credentials or account passwords.
- Use least-privilege demo/read-only credentials, allowlists where available, request timeouts, rate limits, and retry/backoff.

## Acceptance tests
- Anonymous requests are rejected; inactive/non-admin users cannot access private resources.
- Active admin can load all panels and see truthful empty/stale/error states.
- Broker credentials never appear in browser network responses or frontend source.
- Demo connection and read-only quote sync work against the broker's documented demo endpoint.
- Invalid, stale, malformed, or inverted quotes are rejected and do not overwrite verified values.
- Integration monitor shows last check, status, sanitized failure reason, and deployed commit.
- Automated tests prove no order-placement route exists in this milestone.
- Deposit/payment states are not fabricated; live trading and fund movement remain disabled.

## Known current checks
- Supabase Edge Function `admin-api` is active with JWT verification and role checks; it currently supports GET-only resources and returns `liveTradingEnabled: false`.
- `public.integration_status` includes `direct_broker_api` and `ceo_admin_monitoring` tracking rows.
- Supabase security advisor reports leaked-password protection is disabled. Enable this in Supabase Auth security settings before production readiness.
- Existing Pages URL remains the target. Deployment success alone does not prove end-to-end dashboard correctness.
