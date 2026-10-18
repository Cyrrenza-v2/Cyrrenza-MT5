(() => {
  "use strict";
  const API_URL = "https://mvxhpddjtctpvrurqnpg.supabase.co/functions/v1/mt5-demo-data";
  const API_KEY = "sb_publishable_kDtqPySaFV__kndlgY9p3w_Xw20AJBy";
  const resources = ["account", "symbols", "positions", "orders", "deals"];
  const safe = value => String(value ?? "—").replace(/[&<>"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
  const when = value => value ? new Date(value).toLocaleString() : "Not recorded";
  let loading = false;
  function panel() {
    const section = document.getElementById("page-integrations");
    if (!section) return null;
    let host = document.getElementById("cyMt5DemoData");
    if (!host) {
      host = document.createElement("div");
      host.id = "cyMt5DemoData";
      host.className = "panel";
      host.style.marginTop = "16px";
      host.innerHTML = '<div class="panelhead"><div><h2>MT5 demo account sync</h2><p>Read-only broker data via the authenticated Supabase Edge Function</p></div><span class="tag" id="cyMt5DemoStatus">Not checked</span></div><div class="panelbody"><div class="notice" style="border-color:#6b5530">Demo-only. No orders are submitted here. Values remain unavailable until an authorized adapter is configured and explicitly identifies its environment as demo.</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0" id="cyMt5DemoButtons"></div><div id="cyMt5DemoResult" class="empty">Sign in as an active administrator, then choose a read-only resource.</div></div>';
      section.appendChild(host);
      const buttons = host.querySelector("#cyMt5DemoButtons");
      resources.forEach(resource => {
        const button = document.createElement("button");
        button.className = "btn";
        button.type = "button";
        button.textContent = "Load " + resource;
        button.dataset.resource = resource;
        button.addEventListener("click", () => load(resource));
        buttons.appendChild(button);
      });
    }
    return host;
  }
  function summarize(resource, body) {
    const payload = body?.data?.data ?? body?.data;
    if (resource === "account" && payload && typeof payload === "object" && !Array.isArray(payload)) {
      const account = payload.account ?? payload;
      const fields = [["Account", account.accountId ?? account.login ?? account.account], ["Server", account.server], ["Currency", account.currency], ["Balance", account.balance], ["Equity", account.equity], ["Margin", account.margin], ["Free margin", account.freeMargin ?? account.free_margin], ["Leverage", account.leverage]];
      return '<div class="tablewrap"><table><tbody>' + fields.filter(([,v]) => v !== undefined && v !== null).map(([k,v]) => '<tr><th>'+safe(k)+'</th><td>'+safe(v)+'</td></tr>').join("") + '</tbody></table></div>';
    }
    const list = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : Array.isArray(payload?.data) ? payload.data : null;
    if (list) {
      if (!list.length) return '<div class="empty">The adapter returned an empty list. This is not treated as proof that the account is reconciled.</div>';
      const keys = resource === "symbols" ? ["symbol","name","digits","contractSize","volumeMin","volumeMax","volumeStep","tradeAllowed"] :
        resource === "positions" ? ["id","ticket","symbol","side","type","volume","openPrice","currentPrice","profit","updatedAt"] :
        ["id","ticket","orderId","dealId","symbol","side","type","volume","status","state","price","updatedAt","reason"];
      const cols = keys.filter(k => list.some(row => row && row[k] !== undefined && row[k] !== null)).slice(0, 8);
      if (!cols.length) return '<pre style="white-space:pre-wrap;overflow-wrap:anywhere">'+safe(JSON.stringify(list, null, 2))+'</pre>';
      return '<div class="tablewrap"><table><thead><tr>'+cols.map(k=>'<th>'+safe(k)+'</th>').join("")+'</tr></thead><tbody>'+list.slice(0,100).map(row=>'<tr>'+cols.map(k=>'<td>'+safe(row?.[k])+'</td>').join("")+'</tr>').join("")+'</tbody></table></div><p class="pair">Showing up to 100 records.</p>';
    }
    return '<pre style="white-space:pre-wrap;overflow-wrap:anywhere">'+safe(JSON.stringify(payload ?? body, null, 2))+'</pre>';
  }
  async function load(resource) {
    if (loading) return;
    const host = panel();
    const output = document.getElementById("cyMt5DemoResult");
    const status = document.getElementById("cyMt5DemoStatus");
    const sb = window.cyrrenzaSupabase;
    if (!sb?.auth) { output.innerHTML = '<div class="empty">Secure sign-in is not initialized.</div>'; return; }
    const { data } = await sb.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) { output.innerHTML = '<div class="empty">Sign in with an authorized admin account before loading broker data.</div>'; return; }
    loading = true;
    status.textContent = "Checking " + resource + "…";
    output.innerHTML = '<div class="empty">Requesting read-only demo data…</div>';
    try {
      const response = await fetch(API_URL + "?resource=" + encodeURIComponent(resource), { method: "GET", headers: { Authorization: "Bearer " + token, apikey: API_KEY } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        status.textContent = body.status || "Unavailable";
        output.innerHTML = '<div class="notice" style="border-color:#6b5530"><b>' + safe(body.status || "Request failed") + '</b><p>' + safe(body.reason || body.error || ("HTTP " + response.status)) + '</p><p>Environment: ' + safe(body.environment || "unverified") + ' · Checked: ' + safe(when(body.checkedAt)) + '</p></div>';
        return;
      }
      status.textContent = "Demo data available";
      output.innerHTML = '<p class="pair">Environment: <b>DEMO</b> · Observed: '+safe(when(body.observedAt))+' · Trading enabled: No</p>' + summarize(resource, body);
    } catch (error) {
      status.textContent = "Offline";
      output.innerHTML = '<div class="empty">Could not load demo data. Check admin session and adapter configuration.</div>';
    } finally { loading = false; }
  }
  function setup() {
    panel();
    const sb = window.cyrrenzaSupabase;
    if (sb?.auth) {
      sb.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") {
          const output = document.getElementById("cyMt5DemoResult");
          const status = document.getElementById("cyMt5DemoStatus");
          if (output) output.innerHTML = '<div class="empty">Signed out. Sign in again to inspect demo data.</div>';
          if (status) status.textContent = "Signed out";
        }
      });
    } else setTimeout(setup, 250);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup, { once: true }); else setup();
})();
