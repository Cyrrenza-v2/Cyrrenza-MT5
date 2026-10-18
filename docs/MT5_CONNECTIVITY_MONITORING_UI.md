# MT5 authenticated connection monitoring UI

The admin Integrations page includes an **Authenticated MT5 connection check** panel. It calls the Supabase Edge Function `mt5-connectivity-check` with the current signed-in Supabase JWT. It displays the endpoint's status, reason, authentication/connection flags, environment, timestamp, and HTTP response.

## Interpreting the result

- **Not configured**: adapter URL/token secrets are absent.
- **Configured · not fully verified**: the adapter endpoint is configured but did not prove all required MT5 demo checks.
- **Healthy · demo connection verified**: the adapter reports connected=true, authenticated=true, platform=MT5, environment=demo.
- **Degraded / Offline**: the endpoint returned an error or could not be reached.

The UI does not write to the database integration-status table; it displays the live health-check result separately, avoiding false claims that a check has been persisted. The existing integration status row may still show its stored state until a separate authorized status-persistence workflow is implemented.

This check is read-only. It does not submit orders, verify live trading permission, or prove that the broker has granted all commercial/partner permissions. Live trading remains disabled.
