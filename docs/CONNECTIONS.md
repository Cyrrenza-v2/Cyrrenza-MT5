# Connections & Environment Variables

This document lists the environment variables the project expects, explains the purpose of each, and describes where in the codebase they should be provided/read (client-side vs server-side). It also includes secure configuration guidance for local development, CI, and production.

## Summary / Security reminder
- Never commit real secrets (API keys, service_role keys, manager passwords) to the repository.
- Commit only an example file (.env.example). Store real secrets in a secret manager or CI secrets (GitHub Actions Secrets, Vault, AWS/GCP secret managers).
- Client-side code (index.html and inline scripts) must never contain secret keys intended for server-only use (service role keys, MT5 manager passwords). For any secret-requiring action, use a server-side proxy or signed short-lived token.

## Variables the project expects
Organized by category; include these names in .env (or in your environment/secret manager).

### MT5 / Broker connection (server-side only)
- MT5_HOST — broker/manager hostname or IP (e.g. mt5.example.com)
- MT5_PORT — port for manager API (e.g. 443 or 10050)
- MT5_USER — manager API username
- MT5_PASSWORD — manager API password
- MT5_MANAGER_TOKEN — manager API token (if your broker exposes a bearer token)

Purpose: These credentials are used by the server/backend to call the MT5 Manager API for account management, positions, orders and administrative actions. They must never be exposed to the browser.

Where to read: backend code (Node/Python/Go) via process.env or the platform's secrets API.

### Market data provider (server-side or proxy)
- MARKET_FEED_URL — base URL for market data provider
- MARKET_FEED_API_KEY — API key for market data provider (secret)
- MARKET_FEED_TOKEN — bearer/JWT token if used by provider

Purpose: Used to fetch real-time or historical quotes. Prefer server-side fetching and forwarding to clients via a secure API.

Where to read: server or serverless function (not client code). If the UI needs live data, build an authenticated endpoint that proxies requests.

### Supabase / Backend (repo references supabase-admin.js)
- SUPABASE_URL — Supabase project URL (e.g. https://xyz.supabase.co)
- SUPABASE_ANON_KEY — Supabase anon/public key (can be exposed to client-side if intended for public reads with RLS enabled)
- SUPABASE_SERVICE_ROLE_KEY — Supabase service_role key (server-only, secret)

Purpose: index.html and supabase-admin.js reference Supabase. The anon key is suitable only for client-side operations allowed by Row-Level Security (RLS). The service role key must be kept server-side and used only by trusted backend processes.

Where to read:
- index.html / inline scripts: can reference SUPABASE_URL and SUPABASE_ANON_KEY for client initialization. Do NOT embed SUPABASE_SERVICE_ROLE_KEY in client.
- supabase-admin.js: intended for admin tooling — must be executed server-side or in a CI job with secrets available. Use SUPABASE_SERVICE_ROLE_KEY here if admin-level operations are required.

### CI / Deployment / Registry / Monitoring
- DOCKER_REGISTRY_USER — docker registry username (CI secret)
- DOCKER_REGISTRY_PASSWORD — docker registry password (CI secret)
- GITHUB_PAGES_TOKEN or GH_TOKEN — optional, use Actions built-in permissions when possible
- SENTRY_DSN — monitoring DSN (can be public depending on setup but usually a secret)
- PROMETHEUS_PUSHGATEWAY_URL — monitoring endpoint (secret if requires auth)

Purpose: For automated builds, pushes, and monitoring. Store in CI secrets.

### OAuth / Third-party integrations
- OAUTH_CLIENT_ID
- OAUTH_CLIENT_SECRET

Purpose: OAuth client credentials for authentication providers. Client ID can be public; client secret must be server-side only.

### Secrets manager / KMS
- VAULT_ADDR, VAULT_TOKEN or CLOUD_KMS_PROJECT / KMS_KEY etc.

Purpose: If you centralize secrets in Vault or cloud KMS, configure your deployment environment to fetch secrets at runtime rather than embedding in files.

## Where code reads these values
- index.html (client-side inline scripts):
  - Should only initialize client-side SDKs with public or RLS-limited keys: SUPABASE_URL and SUPABASE_ANON_KEY are the primary examples.
  - The market UI in index.html shows placeholders and demo data; to use live feeds, the UI should call a secured server endpoint rather than directly using private API keys.

- supabase-admin.js (admin tooling):
  - This file is referenced by the Pages workflow in CI; treat it as server-side or admin-only code. It may require SUPABASE_SERVICE_ROLE_KEY and other admin secrets; provide them through CI secrets or a secure environment.

- Server / backend (recommended):
  - Any MT5 broker connections, market feed API keys, and service_role keys must be read from the server environment (process.env for Node, os.environ for Python, etc.).
  - Implement a small authenticated API for the client to request market data or perform admin actions. The server-side process uses the secrets to call external services.

## Example usage patterns
- Client init (index.html):
  - Use SUPABASE_URL and SUPABASE_ANON_KEY only. Example (client-side):
    - const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  - For protected actions (admin writes, service role actions) call your server endpoint which performs the action securely.

- CI (GitHub Actions) example snippet to pass secrets to a job step:

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build site
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: |
          # build steps that need server-side admin keys
          echo "Building with SUPABASE_URL=$SUPABASE_URL"
```

Note: For GitHub Pages (static site) do not expose server-side secrets to the deployed assets. Use a server backend, Cloud Run, or serverless functions to perform privileged operations.

## Local development
- Create a local `.env` file (add it to .gitignore) containing real values for development; the repo will keep `.env.example` only.
- Example .env usage in Node (.env loaded by `dotenv`):
  - require('dotenv').config()
  - const mt5Host = process.env.MT5_HOST

## Next steps / recommended hardening
- Add .env.example (done) to show variable names without values.
- Use GitHub Secrets for CI and Actions; do not store keys in repo.
- Implement a small server/proxy for market and MT5 calls so that the browser never sees secret keys.
- Enable Supabase Row-Level Security (RLS) for client-side keys and only allow necessary operations.

---

If you want, I can also:
- Add a short server example (Node/Express) that demonstrates a secure proxy endpoint for market data and MT5 actions.
- Create a small checklist docs/LAUNCH.md that maps the "Launch checklist" items from index.html to concrete steps and verification commands.
