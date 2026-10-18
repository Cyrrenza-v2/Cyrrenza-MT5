# Authenticated MT5 adapter health check

The Supabase Edge Function `mt5-connectivity-check` is a read-only, authenticated health check for a separately hosted broker-authorized MT5 adapter. It does not implement the proprietary MT5 Manager protocol directly and cannot submit orders.

## Function secrets (server-side only)

- `MT5_ADAPTER_HEALTH_URL`: HTTPS URL of the adapter health endpoint, with no embedded credentials, query string, or fragment.
- `MT5_ADAPTER_TOKEN`: bearer token for that endpoint.

Keep broker Manager API credentials only in the adapter's server-side secret store. Never put them in the browser, chat, or Git.

## Health response contract

The adapter must return JSON with `connected: true`, `authenticated: true`, `platform: "MT5"`, and `environment: "demo"`. The function reports healthy only if all four checks pass. It requires a valid Supabase JWT and active admin/compliance/operations profile, rejects non-HTTPS URLs and redirects, and times out after five seconds. It does not expose the adapter response body or any secret.

Until the broker/MetaQuotes partner provides authorized demo endpoint details and credentials, expect `not_configured` or `configured_unverified`. A healthy adapter response is not itself proof of broker authorization; confirm the demo account and permissions with the broker. Live trading remains disabled.
