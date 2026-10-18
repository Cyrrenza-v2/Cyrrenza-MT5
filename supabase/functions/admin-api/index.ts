import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET") return reply({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) return reply({ error: "Backend configuration missing" }, 503);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply({ error: "Authentication required" }, 401);
  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return reply({ error: "Invalid session" }, 401);

  const { data: profile, error: profileError } = await supabase
    .from("admin_profiles").select("role,is_active").eq("user_id", user.id).maybeSingle();
  if (profileError) return reply({ error: "Unable to verify admin authorization" }, 503);
  if (!profile?.is_active || !["admin", "compliance", "operations", "read_only"].includes(profile.role)) {
    return reply({ error: "Active Cyrrenza MT5 admin access required" }, 403);
  }

  const path = new URL(req.url).searchParams.get("resource") ?? "status";
  const queryMap: Record<string, { table: string; select: string; order?: string; limit?: number }> = {
    clients: { table: "clients", select: "id,external_reference,display_name,email,country_code,onboarding_status,created_at", limit: 200 },
    accounts: { table: "broker_accounts", select: "id,client_id,platform,broker_login,account_type,currency,lifecycle_status,provider_account_id,last_provider_sync_at,created_at", limit: 200 },
    instruments: { table: "instruments", select: "symbol,display_name,asset_class,enabled,source,updated_at", limit: 500 },
    orders: { table: "order_requests", select: "id,idempotency_key,client_id,broker_account_id,symbol,side,volume,order_type,requested_price,environment,status,risk_result,risk_reasons,requester_user_id,provider_order_id,policy_version,requested_at,updated_at,submitted_at,reconciled_at", order: "requested_at", limit: 200 },
    approvals: { table: "order_approvals", select: "id,order_request_id,decision,approver_user_id,reason,risk_result,policy_version,decided_at", order: "decided_at", limit: 200 },
    positions: { table: "broker_positions", select: "id,broker_account_id,provider_position_id,symbol,side,volume,open_price,current_price,unrealized_pnl,currency,environment,provider_observed_at,synced_at,reconciled_at", order: "provider_observed_at", limit: 500 },
    equity: { table: "account_equity_snapshots", select: "id,broker_account_id,environment,currency,balance,equity,margin,free_margin,provider_observed_at,synced_at,source", order: "provider_observed_at", limit: 500 },
    reconciliation: { table: "reconciliation_events", select: "id,broker_account_id,event_type,status,external_reference,local_reference,summary,detected_at,resolved_at,resolved_by", order: "detected_at", limit: 500 },
    riskPolicies: { table: "risk_policies", select: "id,policy_key,version,enabled,allowed_environment,max_order_volume,max_open_positions,max_account_exposure,max_quote_age_seconds,require_independent_approver,allowed_symbols,updated_by,updated_at", limit: 200 },
    controls: { table: "trading_controls", select: "control_key,new_orders_enabled,emergency_stop,environment,reason,updated_by,updated_at", limit: 10 },
  };

  if (path === "status") {
    const { data, error } = await supabase.from("integration_status")
      .select("integration_key,status,details,checked_at,updated_at").order("integration_key");
    if (error) return reply({ error: "Could not load integration status" }, 500);
    return reply({ project: "Cyrrenza MT5", authenticated: true, liveTradingEnabled: false, integrations: data });
  }
  if (path === "quotes") {
    const { data, error } = await supabase.from("market_quotes")
      .select("id,symbol,bid,ask,observed_at,source,is_live")
      .order("observed_at", { ascending: false }).limit(200);
    if (error) return reply({ error: "Unable to load market quotes" }, 500);
    const latest = new Map<string, typeof data[number]>();
    for (const quote of data ?? []) if (!latest.has(quote.symbol)) latest.set(quote.symbol, quote);
    const quotes = [...latest.values()];
    const now = Date.now();
    const hasFreshLiveQuote = quotes.some(q => q.is_live && now - new Date(q.observed_at).getTime() <= 60000);
    return reply({ resource: "quotes", data: quotes, liveData: hasFreshLiveQuote, providerConfigured: false,
      message: hasFreshLiveQuote ? "Live-flagged quotes are present; verify provider health independently." : "No fresh provider-verified live quotes. Values are not fabricated." });
  }

  const config = queryMap[path];
  if (!config) return reply({ error: "Unknown resource", allowed: ["status", "clients", "accounts", "instruments", "quotes", ...Object.keys(queryMap).filter(k => !["clients", "accounts", "instruments"].includes(k))] }, 400);

  let query = supabase.from(config.table).select(config.select).limit(config.limit ?? 200);
  if (config.order) query = query.order(config.order, { ascending: false });
  const { data, error } = await query;
  if (error) return reply({ error: "Unable to load requested resource" }, 500);
  return reply({ resource: path, data, liveData: false, liveTradingEnabled: false });
});