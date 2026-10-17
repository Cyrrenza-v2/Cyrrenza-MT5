# Broker Onboarding Runbook

This runbook describes how to onboard partner brokers (and your own broker) into the Cyrrenza MT5 platform, validate connectivity to their MT5 Manager APIs, import symbol catalogs, test demo order flows, and harden the integration for production.

Overview
- Goal: support multiple brokers in the platform, each with its own MT5 Manager endpoint and market-feed / liquidity source. Brokers added by the admin will appear in the platform UI and can be used by clients for demo/real trading depending on configuration and permissions.
- Scope: administrative onboarding (server-side), secure storage of credentials, symbol import and normalization, validation, and testing.

Preconditions
- You have an operational backend server (recommended Node/Express, Python/FastAPI, or similar) that can store broker configs and proxy calls.
- Brokers provide a Manager API endpoint (host, port) and credentials (username/password or bearer token) and any network allowlist information (IP, client certs).
- You have a secrets management approach (env vars + KMS or Vault) for production.

Important security reminder
- Never store MT5 manager passwords or service keys in plain text in the repository or in client-side code.
- Use a secrets manager (Vault, AWS Secrets Manager, GCP Secret Manager) or at minimum GitHub Actions secrets for CI.
- Keep all broker credentials server-side only — the browser must never receive manager passwords or service_role keys.

Data model (Simplified examples)
- SQL (migration example):

```sql
CREATE TABLE brokers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT,
  mt5_host TEXT NOT NULL,
  mt5_port INTEGER DEFAULT 443,
  mt5_auth_type TEXT CHECK (mt5_auth_type IN ('basic','token')) NOT NULL,
  mt5_credential_blob TEXT NOT NULL, -- encrypted JSON (user/pass or token)
  timezone TEXT DEFAULT 'UTC',
  status TEXT DEFAULT 'pending', -- pending | validated | active
  contact_email TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE broker_symbols (
  id SERIAL PRIMARY KEY,
  broker_id INTEGER REFERENCES brokers(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  base_currency TEXT,
  quote_currency TEXT,
  tick_size NUMERIC,
  contract_size NUMERIC,
  session_open TIME, -- store as UTC times
  session_close TIME,
  feed_source TEXT,
  created_at TIMESTAMP DEFAULT now()
);
```

Admin onboarding UI (flows)
1. Add Broker (admin-only)
   - Fields: name, host, port, auth type (basic/token), username, password or token, timezone, contact email.
   - Save: server stores encrypted credential blob and returns broker id.

2. Validate Connection
   - Admin clicks Validate → server attempts to authenticate against the broker Manager API and fetch capabilities and a symbol list.
   - Result shown in UI: success/failure, server version, supported features.

3. Import Symbols
   - Admin reviews & approves the symbol list returned by the broker and imports it into the broker_symbols table.

4. Configure Market Feed / Liquidity
   - Choose whether the platform will rely on broker-provided quotes, an independent market feed, or an LP.
   - Configure mapping and fallback rules (e.g., use LP if broker feed is stale).

Backend endpoints (API spec)
- POST /api/admin/brokers
  - Body: { name, mt5_host, mt5_port, mt5_auth_type, username?, password?, token?, timezone?, contact_email? }
  - Behavior: validate required fields, encrypt credential blob, persist broker with status "pending".
  - Response: { id }

- POST /api/admin/brokers/:id/validate
  - Auth: admin
  - Behavior: decrypt credentials, try to authenticate, fetch server info and symbol list (best-effort). Return details and status.
  - Response: { ok: true|false, details: { version?, symbols?: count|array, error? } }

- POST /api/admin/brokers/:id/import-symbols
  - Auth: admin
  - Behavior: fetch symbols (or accept local upload) and upsert into broker_symbols. Return import summary.
  - Response: { imported: N, skipped: M }

- GET /api/market/:broker_id/:symbol
  - Public or authenticated depending on configuration
  - Behavior: proxy to configured feed (broker or LP) and return normalized quote JSON

Validation & test commands (examples)
- Add a broker using curl (example):

```bash
curl -X POST https://platform.example.com/api/admin/brokers \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"ExampleBroker","mt5_host":"demo.mt5.example.com","mt5_port":443,"mt5_auth_type":"basic","username":"admin","password":"secret","timezone":"Europe/London","contact_email":"ops@examplebroker.com"}'
```

- Validate connection:

```bash
curl -X POST https://platform.example.com/api/admin/brokers/42/validate \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

Expected validation results:
- ok: true
- details.version: server version string
- details.symbols: number of symbols fetched (or sample list)
- If validation fails, the details.error field should include a short, actionable message (e.g., "authentication failed", "network timeout", "certificate required").

Symbol import verification
- After import, verify sample symbol row(s):

```sql
SELECT symbol, base_currency, quote_currency, tick_size FROM broker_symbols WHERE broker_id = 42 LIMIT 5;
```

Demo order flow test (sandbox)
- Create a demo client account in your platform and map it to a demo account on the broker (or use a sandbox MT5 server).
- Place a test order via server API (server will call MT5 Manager):

```bash
curl -X POST https://platform.example.com/api/mt5/42/orders \
  -H "Authorization: Bearer <ADMIN_OR_CLIENT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"account":"MT5-D-20101","symbol":"EURUSD","side":"BUY","volume":0.1}'
```

- Verify the order shows up in MT5 demo account and that the order lifecycle (pending → filled) is observed.

Timezones and London session handling
- Store session open/close times in UTC in the symbol table.
- Use timezone-aware libraries (e.g., moment-timezone or luxon) when parsing/displaying times in the UI.
- London trading sessions change for DST — store timezone (e.g., Europe/London) per broker or per symbol and convert to UTC for runtime checks.

Monitoring & alerts
- Track these metrics per-broker:
  - Validation success rate
  - Fetch latency for symbol lists and quotes
  - Error rates on order placement
- Create alerts when a broker goes "unreachable" or when feed latency exceeds a threshold.

CI & automated tests
- Add integration tests against a demo MT5 server (self-hosted or provided by brokers).
- CI job should run (with secrets provided only to the job):
  - Broker validation
  - Symbol import test
  - Sample order placement & status retrieval
- Ensure the CI step never writes service_role or manager passwords into build artifacts.

Production hardening checklist
- Use KMS/Vault for encrypting/storing credential blobs.
- Rotate credentials periodically and support re-validation in admin UI.
- Enforce RBAC: admin-only for adding/validating/importing brokers.
- Audit: log who added/modified broker configs, and keep these logs immutable.

What I can produce next
- A runnable Node example (server/onboard.js) that implements the API endpoints above and demonstrates encrypted credential storage and best-effort validation (I will add this file if you want).
- DB migration SQL ready for Postgres.
- Admin UI snippets to call the new endpoints.

If you want me to commit the Node server example now, I'll add server/onboard.js to the repo and provide instructions to run it in local/demo mode.