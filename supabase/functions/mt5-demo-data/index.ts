import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

const resources: Record<string, string> = {
  account: "/v1/account",
  symbols: "/v1/symbols",
  positions: "/v1/positions",
  orders: "/v1/orders",
  deals: "/v1/deals",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET") return reply({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = req.headers.get("Authorization");
  if (!supabaseUrl || !supabaseKey) return reply({ error: "Backend configuration missing" }, 503);
  if (!authorization?.startsWith("Bearer ")) return reply({ error: "Authentication required" }, 401);

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return reply({ error: "Invalid session" }, 401);

  const { data: profile, error: profileError } = await supabase
    .from("admin_profiles")
    .select("role,is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) return reply({ error: "Unable to verify admin authorization" }, 503);
  if (!profile?.is_active || !["admin", "compliance", "operations"].includes(profile.role)) {
    return reply({ error: "Active privileged Cyrrenza MT5 admin access required" }, 403);
  }

  const resource = new URL(req.url).searchParams.get("resource") ?? "";
  const path = resources[resource];
  if (!path) return reply({ error: "Unsupported resource", allowedResources: Object.keys(resources) }, 400);

  const base = Deno.env.get("MT5_ADAPTER_API_BASE_URL");
  const token = Deno.env.get("MT5_ADAPTER_API_TOKEN");
  if (!base || !token) {
    return reply({
      integration: "mt5_demo_adapter",
      status: "not_configured",
      environment: "unverified",
      resource,
      tradingEnabled: false,
      checkedAt: new Date().toISOString(),
      reason: "Read-only demo adapter is not configured.",
      requiredSecrets: ["MT5_ADAPTER_API_BASE_URL", "MT5_ADAPTER_API_TOKEN"],
    }, 503);
  }

  let target: URL;
  try {
    target = new URL(base);
    if (target.protocol !== "https:" || target.username || target.password || target.search || target.hash) {
      return reply({ status: "configured_unverified", tradingEnabled: false, reason: "Adapter base URL must use HTTPS without embedded credentials, query, or fragment." }, 503);
    }
    target.pathname = target.pathname.replace(/\/$/, "") + path;
  } catch {
    return reply({ status: "configured_unverified", tradingEnabled: false, reason: "Adapter base URL is invalid." }, 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const upstream = await fetch(target.toString(), {
      method: "GET",
      headers: { Authorization: "Bearer " + token, Accept: "application/json" },
      redirect: "error",
      signal: controller.signal,
    });
    if (!upstream.ok) {
      return reply({
        integration: "mt5_demo_adapter",
        status: upstream.status === 401 || upstream.status === 403 ? "unauthorized" : "degraded",
        resource,
        tradingEnabled: false,
        httpStatus: upstream.status,
        checkedAt: new Date().toISOString(),
        reason: "Adapter request failed; upstream response body omitted.",
      }, 502);
    }

    const raw = await upstream.text();
    if (raw.length > 1_000_000) {
      return reply({ status: "invalid_response", resource, tradingEnabled: false, reason: "Adapter response exceeded the 1 MB safety limit." }, 502);
    }
    let payload: any;
    try {
      payload = JSON.parse(raw);
    } catch {
      return reply({ status: "invalid_response", resource, tradingEnabled: false, reason: "Adapter returned malformed JSON." }, 502);
    }

    const environment = String(payload?.environment ?? payload?.data?.environment ?? "").toLowerCase();
    if (environment !== "demo") {
      return reply({
        integration: "mt5_demo_adapter",
        status: "wrong_or_unverified_environment",
        resource,
        environment: environment || "unverified",
        tradingEnabled: false,
        checkedAt: new Date().toISOString(),
        reason: "Adapter response must explicitly identify environment=demo. Data withheld.",
      }, 503);
    }

    const providerTimestamp = payload?.timestamp ?? payload?.checkedAt ?? payload?.data?.timestamp ?? null;
    const parsedTimestamp = typeof providerTimestamp === "string" ? Date.parse(providerTimestamp) : NaN;
    const stale = Number.isFinite(parsedTimestamp) && Date.now() - parsedTimestamp > 120_000;
    if (stale) {
      return reply({
        integration: "mt5_demo_adapter",
        status: "stale",
        resource,
        environment: "demo",
        providerTimestamp,
        checkedAt: new Date().toISOString(),
        tradingEnabled: false,
        reason: "Adapter data is older than 120 seconds; stale data withheld.",
      }, 503);
    }

    return reply({
      integration: "mt5_demo_adapter",
      status: "available",
      resource,
      environment: "demo",
      providerTimestamp,
      observedAt: new Date().toISOString(),
      tradingEnabled: false,
      data: payload,
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "AbortError";
    return reply({
      integration: "mt5_demo_adapter",
      status: timedOut ? "timeout" : "offline",
      resource,
      environment: "unverified",
      checkedAt: new Date().toISOString(),
      tradingEnabled: false,
      reason: timedOut ? "Adapter request timed out after 7 seconds." : "Adapter could not be reached; verify TLS, network, allow-list, and service status.",
    }, 502);
  } finally {
    clearTimeout(timeout);
  }
});
