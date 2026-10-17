(() => {
  "use strict";
  const API_URL = "https://mvxhpddjtctpvrurqnpg.supabase.co/functions/v1/admin-api";
  const API_KEY = "sb_publishable_kDtqPySaFV__kndlgY9p3w_Xw20AJBy";
  const safe = value => String(value ?? "").replace(/[&<>"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
  const when = value => value ? new Date(value).toLocaleString() : "Not recorded";
  const statusLabel = status => ({healthy:"Healthy",configured_unverified:"Configured · unverified",not_configured:"Not configured",degraded:"Degraded",offline:"Offline"})[status] || "Unknown";
  const statusClass = status => status === "healthy" ? "healthy" : (status === "degraded" || status === "offline" ? "bad" : "pending");
  let lastToken = null, loading = false;
  function panel() {
    const section = document.getElementById("page-integrations");
    if (!section) return null;
    let host = document.getElementById("cyLiveIntegrationMonitor");
    if (!host) {
      host = document.createElement("div");
      host.id = "cyLiveIntegrationMonitor";
      host.innerHTML = '<div class="notice" style="border-color:#6b5530">Live trading, order execution, deposits and withdrawals are disabled. Integration states below come from the authenticated backend; a successful website deployment does not prove provider connectivity.</div><div class="panel" style="margin-bottom:16px"><div class="panelhead"><div><h2>Live integration monitoring</h2><p>Authenticated Supabase status and quote checks</p></div><span id="cyMonitorChecked" class="tag">Not checked</span></div><div id="cyMonitorRows"><div class="empty">Sign in as an authorized administrator to load integration status.</div></div></div><div class="panel"><div class="panelhead"><div><h2>Market-data health</h2><p>Only stored provider quotes are displayed; no synthetic prices</p></div><span id="cyQuoteHealth" class="tag">Not checked</span></div><div id="cyQuoteRows" class="panelbody"><div class="empty">Waiting for an authenticated check.</div></div></div>';
      section.insertBefore(host, section.firstChild);
    }
    return host;
  }
  async function fetchResource(resource, token) {
    const response = await fetch(API_URL + "?resource=" + encodeURIComponent(resource), {
      method: "GET",
      headers: {Authorization: "Bearer " + token, apikey: API_KEY}
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || ("Request failed (" + response.status + ")"));
    return body;
  }
  function renderStatus(status, quotes) {
    const host = panel(); if (!host) return;
    const rows = Array.isArray(status.integrations) ? status.integrations : [];
    const preferred = ["github_deployment","ceo_admin_monitoring","market_data","direct_broker_api","metaapi_market_data","mt5_manager_api"];
    rows.sort((a,b) => {
      const ai=preferred.indexOf(a.integration_key), bi=preferred.indexOf(b.integration_key);
      return (ai<0?999:ai)-(bi<0?999:bi) || a.integration_key.localeCompare(b.integration_key);
    });
    const list = document.getElementById("cyMonitorRows");
    list.innerHTML = rows.length ? rows.map(item => {
      const details = item.details && typeof item.details === "object" ? item.details : {};
      const note = details.reason || details.message || details.monitoring_ui || details.note || "No diagnostic message recorded.";
      return '<div class="kpi"><div style="min-width:0;flex:1"><b>'+safe(item.integration_key.replace(/_/g," "))+'</b><div class="pair">'+safe(note)+'</div><div class="pair">Last checked: '+safe(when(item.checked_at))+' · Updated: '+safe(when(item.updated_at))+'</div></div><span class="status '+statusClass(item.status)+'">'+safe(statusLabel(item.status))+'</span></div>';
    }).join("") : '<div class="empty">No integration status records are configured yet.</div>';
    const checked = document.getElementById("cyMonitorChecked");
    if (checked) checked.textContent = "Checked " + new Date().toLocaleTimeString();
    const quoteRows = document.getElementById("cyQuoteRows");
    const quoteBadge = document.getElementById("cyQuoteHealth");
    const data = Array.isArray(quotes.data) ? quotes.data : [];
    if (quoteBadge) quoteBadge.textContent = quotes.providerConfigured ? "Provider configured" : "No verified provider";
    if (quoteRows) {
      quoteRows.innerHTML = data.length ? '<div class="tablewrap"><table><thead><tr><th>Symbol</th><th>Bid</th><th>Ask</th><th>Source</th><th>Observed</th><th>Mode</th></tr></thead><tbody>'+data.map(q=>'<tr><td>'+safe(q.symbol)+'</td><td>'+safe(q.bid ?? "—")+'</td><td>'+safe(q.ask ?? "—")+'</td><td>'+safe(q.source || "Unknown")+'</td><td>'+safe(when(q.observed_at))+'</td><td><span class="status '+(q.is_live?"bad":"pending")+'">'+(q.is_live?"Live-flagged; verify":"Non-live")+'</span></td></tr>').join("")+'</tbody></table></div>' : '<div class="empty">'+safe(quotes.message || "No quotes stored. This is expected until a verified provider is configured.")+'</div>';
    }
    const trading = status.liveTradingEnabled === true;
    const note = host.querySelector(".notice");
    if (note) note.textContent = trading ? "WARNING: backend reports live trading enabled. This dashboard must not be used until the configuration is reviewed." : "Safety lock: backend reports live trading disabled. Order execution, deposits and withdrawals are not available in this milestone.";
  }
  async function refresh() {
    if (loading) return;
    const sb = window.cyrrenzaSupabase;
    if (!sb?.auth) { const host=panel(); if(host){const el=document.getElementById("cyMonitorRows");if(el)el.innerHTML='<div class="empty">Secure sign-in is initializing. Retry in a moment.</div>';} return; }
    const {data} = await sb.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return;
    loading = true;
    const host=panel();
    const row=document.getElementById("cyMonitorRows");
    if(row)row.innerHTML='<div class="empty">Checking integration status…</div>';
    try {
      const [status, quotes] = await Promise.all([fetchResource("status",token),fetchResource("quotes",token)]);
      lastToken=token; renderStatus(status,quotes);
    } catch (error) {
      const el=document.getElementById("cyMonitorRows");
      if(el)el.innerHTML='<div class="empty">Could not refresh monitoring: '+safe(error.message)+'. Check your admin session and backend availability.</div>';
      const q=document.getElementById("cyQuoteRows"); if(q)q.innerHTML='<div class="empty">Quote status could not be loaded.</div>';
    } finally { loading=false; }
  }
  function setup() {
    const host=panel();
    const oldButton=document.getElementById("checkIntegrations");
    if(oldButton && !oldButton.dataset.cyMonitorBound) {
      const replacement=oldButton.cloneNode(true);
      replacement.dataset.cyMonitorBound="true";
      replacement.textContent="↻ Refresh integration status";
      oldButton.replaceWith(replacement);
      replacement.addEventListener("click",refresh);
    }
    const refreshView=document.getElementById("refresh");
    if(refreshView && !refreshView.dataset.cyMonitorBound) {
      refreshView.dataset.cyMonitorBound="true";
      refreshView.addEventListener("click",refresh);
    }
    const sb=window.cyrrenzaSupabase;
    if(sb?.auth) {
      sb.auth.getSession().then(({data})=>{if(data?.session)refresh();});
      sb.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_IN" && session)refresh(); if(event==="SIGNED_OUT"){const r=document.getElementById("cyMonitorRows");if(r)r.innerHTML='<div class="empty">Sign in as an authorized administrator to load integration status.</div>';}});
    } else setTimeout(setup,250);
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",setup,{once:true}); else setup();
})();