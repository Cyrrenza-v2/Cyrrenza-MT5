(() => {
  "use strict";
  const PROJECT_URL = "https://mvxhpddjtctpvrurqnpg.supabase.co";
  const API_KEY = "sb_publishable_kDtqPySaFV__kndlgY9p3w_Xw20AJBy";
  const safe = value => String(value ?? "").replace(/[&<>"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
  const label = status => ({healthy:"Healthy · demo connection verified",configured_unverified:"Configured · not fully verified",not_configured:"Not configured",degraded:"Degraded",offline:"Offline"})[status] || "Unknown";
  function mount() {
    const section = document.getElementById("page-integrations");
    if (!section || document.getElementById("cyMt5HealthPanel")) return;
    const panel = document.createElement("div");
    panel.id = "cyMt5HealthPanel";
    panel.className = "panel";
    panel.style.marginBottom = "16px";
    panel.innerHTML = '<div class="panelhead"><div><h2>Authenticated MT5 connection check</h2><p>Server-side adapter health · read-only · demo only</p></div><button id="cyMt5HealthRun" class="btn" type="button">Run MT5 check</button></div><div id="cyMt5HealthResult" class="panelbody"><div class="empty">Sign in as an authorized administrator, then run the check. This does not place trades.</div></div>';
    section.insertBefore(panel, section.firstChild);
    panel.querySelector("#cyMt5HealthRun").addEventListener("click", run);
  }
  async function run() {
    const button = document.getElementById("cyMt5HealthRun");
    const result = document.getElementById("cyMt5HealthResult");
    const sb = window.cyrrenzaSupabase;
    if (!sb?.auth) { result.innerHTML = '<div class="empty">Secure sign-in is not initialized yet. Refresh and sign in again.</div>'; return; }
    const {data, error} = await sb.auth.getSession();
    const token = data?.session?.access_token;
    if (error || !token) { result.innerHTML = '<div class="empty">Sign in as an authorized administrator before checking MT5.</div>'; return; }
    button.disabled = true; button.textContent = "Checking…";
    result.innerHTML = '<div class="empty">Checking configured server-side adapter. No order will be submitted.</div>';
    try {
      const response = await fetch(PROJECT_URL + "/functions/v1/mt5-connectivity-check", {
        method: "GET",
        headers: {Authorization: "Bearer " + token, apikey: API_KEY}
      });
      const body = await response.json().catch(() => ({}));
      const status = body.status || (response.ok ? "configured_unverified" : "offline");
      const note = body.reason || body.error || "No diagnostic reason was returned.";
      const badgeClass = status === "healthy" ? "healthy" : (status === "offline" || status === "degraded" ? "bad" : "pending");
      result.innerHTML = '<div class="kpi"><div style="min-width:0;flex:1"><b>' + safe(label(status)) + '</b><div class="pair">' + safe(note) + '</div><div class="pair">Authenticated: ' + (body.authenticated === true ? "Yes" : "No") + ' · Connected: ' + (body.connected === true ? "Yes" : "No") + ' · Environment: ' + safe(body.environment || "unverified") + '</div><div class="pair">Checked: ' + safe(body.checkedAt ? new Date(body.checkedAt).toLocaleString() : "Not recorded") + ' · HTTP ' + response.status + '</div><div class="pair">Trading remains disabled.</div></div><span class="status ' + badgeClass + '">' + safe(status) + '</span></div>';
    } catch (error) {
      result.innerHTML = '<div class="empty">Could not reach the health-check function: ' + safe(error?.message || "network error") + '. Verify backend availability. Trading remains disabled.</div>';
    } finally { button.disabled = false; button.textContent = "Run MT5 check"; }
  }
  function setup() {
    mount();
    if (!document.getElementById("cyMt5HealthPanel")) setTimeout(setup, 250);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup, {once:true}); else setup();
})();