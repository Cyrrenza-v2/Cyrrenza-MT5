(() => {
  "use strict";

  // Cyrrenza MT5 admin operations UI. Read-only until a broker adapter and
  // server-authorized workflow endpoints are implemented and verified.
  const safe = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
  const when = value => value ? new Date(value).toLocaleString() : "Not recorded";
  const status = (label, kind="pending") => '<span class="status '+kind+'">'+safe(label)+'</span>';
  const tableEmpty = (cols, text) => '<tr><td colspan="'+cols+'" class="empty">'+safe(text)+'</td></tr>';
  const unavailable = "Not available from the currently verified read-only API.";
  let loaded = false;

  function addNavAndSections() {
    const nav = document.getElementById("nav");
    if (!nav || document.getElementById("page-approvals")) return;
    const additions = [
      ["approvals","✓","Order Approval Queue"],
      ["accounts-positions","▤","Accounts & Positions"],
      ["security-risk","⚿","Security, Risk & Audit"]
    ];
    const integrations = nav.querySelector('[data-page="integrations"]');
    additions.forEach(([page, glyph, label]) => {
      const button = document.createElement("button");
      button.dataset.page = page;
      button.innerHTML = '<span class="ni">'+glyph+'</span>'+label;
      nav.insertBefore(button, integrations || null);
      button.addEventListener("click", () => { if (typeof window.go === "function") window.go(page); });
    });

    const footnote = document.querySelector(".footnote");
    const markup = `
      <section class="section" id="page-approvals">
        <div class="pagehead"><div><div class="eyebrow">CONTROLLED DEMO OPERATIONS</div><h1>Order Approval Queue</h1><p class="sub">Review request status and risk evidence. Execution is locked until a verified broker demo adapter and server-side approval API exist.</p></div><span class="tag">EXECUTION DISABLED</span></div>
        <div class="notice">Safety lock: this console currently exposes a read-only API. It cannot approve, reject, cancel, or submit orders. No sample orders are presented as real broker activity.</div>
        <div class="grid stats">
          <div class="panel stat"><div class="stathead">Pending approvals</div><div class="value" id="opsPending">—</div><div class="hint">Server queue not exposed</div></div>
          <div class="panel stat"><div class="stathead">Rejected orders</div><div class="value" id="opsRejected">—</div><div class="hint">Broker order history unavailable</div></div>
          <div class="panel stat"><div class="stathead">Risk-blocked requests</div><div class="value" id="opsRiskBlocked">—</div><div class="hint">No verified risk engine endpoint</div></div>
          <div class="panel stat"><div class="stathead">Execution state</div><div class="value" style="font-size:20px">Locked</div><div class="hint">Demo-only target; adapter unverified</div></div>
        </div>
        <div class="panel"><div class="panelhead"><div><h2>Approval history</h2><p>Only broker/backend-confirmed records may appear here.</p></div><span class="tag" id="approvalSource">Not connected</span></div><div class="tablewrap"><table><thead><tr><th>REQUEST</th><th>ACCOUNT</th><th>SYMBOL / SIDE</th><th>RISK RESULT</th><th>REQUESTER</th><th>APPROVER</th><th>OUTCOME</th><th>UPDATED</th></tr></thead><tbody id="approvalRows"></tbody></table></div></div>
        <div class="grid cards3" style="margin-top:15px">
          <div class="panel feature"><h3>Requester / approver separation</h3><p>Required server-side rule: a requester must not approve their own order. Approval identity and policy version must be persisted.</p></div>
          <div class="panel feature"><h3>Risk checks</h3><p>Validate demo account allowlist, enabled symbol, quote freshness, volume and exposure limits before approval and again before submission.</p></div>
          <div class="panel feature"><h3>Broker-confirmed outcomes</h3><p>Do not mark a request filled from an HTTP success alone. Reconcile external order IDs, fills and positions with the broker.</p></div>
        </div>
      </section>
      <section class="section" id="page-accounts-positions">
        <div class="pagehead"><div><div class="eyebrow">BROKER STATE</div><h1>Accounts, Instruments & Positions</h1><p class="sub">Broker account snapshots and enabled instruments from authenticated backend resources, with explicit source and freshness.</p></div><button class="btn" id="opsRefreshAccounts">Refresh data</button></div>
        <div class="notice">The broker remains the source of truth. Account records in Supabase do not prove a working MT5 connection; positions and equity stay unavailable unless returned by a verified provider.</div>
        <div class="grid stats">
          <div class="panel stat"><div class="stathead">Registered accounts</div><div class="value" id="opsAccountCount">—</div><div class="hint">Supabase account records</div></div>
          <div class="panel stat"><div class="stathead">Enabled instruments</div><div class="value" id="opsEnabledInstruments">—</div><div class="hint">Backend catalogue</div></div>
          <div class="panel stat"><div class="stathead">Fresh quotes</div><div class="value" id="opsFreshQuotes">—</div><div class="hint">Observed within 60 seconds</div></div>
          <div class="panel stat"><div class="stathead">Demo equity</div><div class="value" id="opsDemoEquity" style="font-size:20px">Unavailable</div><div class="hint">No verified MT5 account snapshot</div></div>
        </div>
        <div class="panel" style="margin-bottom:15px"><div class="panelhead"><div><h2>Broker accounts</h2><p>Account type and currency must be verified against the provider.</p></div><span class="tag" id="opsAccountsSource">Waiting for sign-in</span></div><div class="tablewrap"><table><thead><tr><th>ACCOUNT REFERENCE</th><th>CLIENT</th><th>ENVIRONMENT</th><th>CURRENCY</th><th>STATUS</th><th>LAST SYNC</th></tr></thead><tbody id="opsAccountRows"></tbody></table></div></div>
        <div class="panel" style="margin-bottom:15px"><div class="panelhead"><div><h2>Enabled instruments & quotes</h2><p>Quotes are usable for trading only after source and freshness checks.</p></div></div><div class="tablewrap"><table><thead><tr><th>SYMBOL</th><th>ENABLED</th><th>BID</th><th>ASK</th><th>SOURCE</th><th>OBSERVED</th><th>FRESHNESS</th></tr></thead><tbody id="opsInstrumentRows"></tbody></table></div></div>
        <div class="panel"><div class="panelhead"><div><h2>Open positions</h2><p>Position data is intentionally not fabricated.</p></div><span class="tag">READ ONLY</span></div><div class="tablewrap"><table><thead><tr><th>POSITION</th><th>ACCOUNT</th><th>SYMBOL</th><th>VOLUME</th><th>OPEN PRICE</th><th>UNREALIZED P/L</th><th>RECONCILED</th></tr></thead><tbody id="opsPositionRows"></tbody></table></div></div>
      </section>
      <section class="section" id="page-security-risk">
        <div class="pagehead"><div><div class="eyebrow">GOVERNANCE & SAFETY</div><h1>Security, Risk & Audit</h1><p class="sub">Visibility into verified security state, risk configuration, kill-switch status and searchable audit records.</p></div><span class="tag">NO PRIVILEGED WRITES</span></div>
        <div class="notice">The current API is read-only. Controls below show required release gates; toggles cannot truthfully enforce MFA, alter server risk limits, or operate a kill switch without server-side endpoints.</div>
        <div class="grid stats">
          <div class="panel stat"><div class="stathead">Admin MFA</div><div class="value" style="font-size:20px" id="opsMfaState">Unverified</div><div class="hint">Verify Supabase policy and sessions</div></div>
          <div class="panel stat"><div class="stathead">Risk policy</div><div class="value" style="font-size:20px" id="opsRiskState">Unverified</div><div class="hint">Must be enforced server-side</div></div>
          <div class="panel stat"><div class="stathead">Kill switch</div><div class="value" style="font-size:20px" id="opsKillState">Unknown</div><div class="hint">No control endpoint exposed</div></div>
          <div class="panel stat"><div class="stathead">Reconciliation errors</div><div class="value" id="opsReconErrors">—</div><div class="hint">Reconciliation API unavailable</div></div>
        </div>
        <div class="grid mainrow">
          <div class="panel"><div class="panelhead"><div><h2>Security and risk controls</h2><p>Read-only policy status and launch requirements</p></div></div><div class="panelbody">
            <div class="toggleline"><div><b>Require MFA for privileged roles</b><div class="hint">Enforce with Supabase Auth assurance policy and backend checks.</div></div><span class="status pending">Verify in Auth settings</span></div>
            <div class="toggleline"><div><b>Independent order approver</b><div class="hint">Reject self-approval on the server and record approver identity.</div></div><span class="status pending">API not implemented</span></div>
            <div class="toggleline"><div><b>Demo-only account allowlist</b><div class="hint">Execution service must reject every account not explicitly marked demo.</div></div><span class="status pending">Adapter unavailable</span></div>
            <div class="toggleline"><div><b>Kill switch for new orders</b><div class="hint">Server-enforced; existing-position close is a separate authorized action.</div></div><button class="btn" id="opsKillSwitch" disabled title="No secure server-side kill-switch endpoint is available">Unavailable</button></div>
          </div></div>
          <div class="panel"><div class="panelhead"><div><h2>Security alerts</h2><p>Known gaps requiring an owner action</p></div></div><div class="panelbody marketlist" id="opsSecurityAlerts">
            <div class="market"><div><div class="symbol">Broker access</div><div class="pair">No authorized MT5 integration confirmed</div></div><span class="status pending">Blocker</span></div>
            <div class="market"><div><div class="symbol">Write API</div><div class="pair">Approvals and execution endpoints not verified</div></div><span class="status pending">Blocker</span></div>
            <div class="market"><div><div class="symbol">MFA / password protection</div><div class="pair">Verify project authentication settings</div></div><span class="status pending">Action required</span></div>
          </div></div>
        </div>
        <div class="panel" style="margin-top:15px"><div class="panelhead"><div><h2>Searchable audit events</h2><p>Server-side audit records only; local browser events are not security evidence.</p></div><input class="search" id="opsAuditSearch" placeholder="Search event, actor or reference…"></div><div class="tablewrap"><table><thead><tr><th>TIME</th><th>ACTOR</th><th>ACTION</th><th>ENTITY</th><th>DETAIL</th><th>ENVIRONMENT</th></tr></thead><tbody id="opsAuditRows"></tbody></table></div></div>
      </section>`;
    footnote?.insertAdjacentHTML("beforebegin", markup);
    const initialRoute = (location.hash || "").replace(/^#/, "");
    if (["approvals", "accounts-positions", "security-risk"].includes(initialRoute) && typeof window.go === "function") window.go(initialRoute, {updateUrl:false});
    document.getElementById("opsRefreshAccounts")?.addEventListener("click", () => {
      if (window.cyrrenzaRefreshBackend) window.cyrrenzaRefreshBackend();
      renderBackend(window.cyrrenzaBackendData || null);
    });
    document.getElementById("opsAuditSearch")?.addEventListener("input", () => renderAudit(window.cyrrenzaBackendData || null));
    loaded = true;
  }

  function renderBackend(payload) {
    if (!loaded) return;
    const clients = Array.isArray(payload?.clients) ? payload.clients : [];
    const accounts = Array.isArray(payload?.accounts) ? payload.accounts : [];
    const instruments = Array.isArray(payload?.instruments) ? payload.instruments : [];
    const quotes = Array.isArray(payload?.quotes) ? payload.quotes : [];
    const signedIn = !!payload?.status;
    const fresh = q => {
      const t = q?.observed_at ? new Date(q.observed_at).getTime() : NaN;
      return Number.isFinite(t) && Date.now() - t >= -5000 && Date.now() - t <= 60000 &&
        Number.isFinite(Number(q.bid)) && Number.isFinite(Number(q.ask)) &&
        Number(q.bid) > 0 && Number(q.ask) >= Number(q.bid) && q.is_live === true;
    };
    const put = (id, value) => { const el=document.getElementById(id); if(el)el.textContent=value; };
    put("opsAccountCount", signedIn ? accounts.length : "—");
    put("opsEnabledInstruments", signedIn ? instruments.filter(i=>i.enabled===true).length : "—");
    put("opsFreshQuotes", signedIn ? quotes.filter(fresh).length : "—");
    put("opsDemoEquity", "Unavailable");
    put("opsAccountsSource", signedIn ? "Supabase records · broker not verified" : "Waiting for sign-in");
    put("opsMfaState", "Unverified");
    put("opsRiskState", "Not enforced");
    put("opsKillState", "Unknown");
    put("opsReconErrors", "—");

    const accountRows=document.getElementById("opsAccountRows");
    if(accountRows) accountRows.innerHTML = !signedIn ? tableEmpty(6,"Sign in as an authorized administrator to load account records.") :
      (accounts.length ? accounts.map(a=>{
        const client=clients.find(c=>c.id===a.client_id);
        return '<tr><td>'+safe(a.broker_login||a.account_ref||a.id||"Unlabelled")+'</td><td>'+safe(client?.display_name||client?.email||"—")+'</td><td>'+status("Unverified","pending")+'</td><td>'+safe(a.currency||"Unknown")+'</td><td>'+safe(a.lifecycle_status||"Unknown")+'</td><td>'+safe(when(a.last_synced_at||a.updated_at))+'</td></tr>';
      }).join("") : tableEmpty(6,"No account records are configured. This is not proof of broker connectivity."));
    const instrumentRows=document.getElementById("opsInstrumentRows");
    if(instrumentRows) instrumentRows.innerHTML = !signedIn ? tableEmpty(7,"Sign in to load instrument and quote records.") :
      (instruments.length ? instruments.map(i=>{
        const q=quotes.find(x=>x.symbol===i.symbol);
        const isFresh=fresh(q);
        return '<tr><td><b>'+safe(i.symbol)+'</b><div class="pair">'+safe(i.display_name||"")+'</div></td><td>'+status(i.enabled===true?"Enabled":"Disabled",i.enabled===true?"":"off")+'</td><td>'+safe(isFresh?q.bid:"—")+'</td><td>'+safe(isFresh?q.ask:"—")+'</td><td>'+safe(isFresh?(q.source||"Provider source unverified"):"No verified live quote")+'</td><td>'+safe(when(q?.observed_at))+'</td><td>'+status(isFresh?"Fresh · source still verify":"Stale / unavailable",isFresh?"":"pending")+'</td></tr>';
      }).join("") : tableEmpty(7,"No instruments are configured."));
    const pos=document.getElementById("opsPositionRows");
    if(pos)pos.innerHTML=tableEmpty(7,unavailable+" No positions are fabricated.");
    const approvals=document.getElementById("approvalRows");
    if(approvals)approvals.innerHTML=tableEmpty(8,unavailable+" Order approval history is not yet exposed by the backend.");
    put("approvalSource", "Read-only API");
    put("opsPending","—");put("opsRejected","—");put("opsRiskBlocked","—");
    renderAudit(payload);
  }

  function renderAudit(payload) {
    const target=document.getElementById("opsAuditRows");
    if(!target)return;
    const q=(document.getElementById("opsAuditSearch")?.value||"").toLowerCase();
    const events=Array.isArray(payload?.auditEvents)?payload.auditEvents:[];
    const filtered=events.filter(e=>JSON.stringify(e).toLowerCase().includes(q));
    target.innerHTML=filtered.length?filtered.map(e=>'<tr><td>'+safe(when(e.created_at||e.occurred_at))+'</td><td>'+safe(e.actor_email||e.actor_id||"System")+'</td><td>'+safe(e.action||e.event_type||"Unknown")+'</td><td>'+safe(e.entity_type||e.entity_id||"—")+'</td><td>'+safe(e.details?.message||e.reason||"—")+'</td><td>'+safe(e.environment||"Unknown")+'</td></tr>').join(""):tableEmpty(6,events.length?"No matching audit events.":unavailable+" Durable audit-event resource is not exposed.");
  }

  function init() {
    addNavAndSections();
    renderBackend(window.cyrrenzaBackendData || null);
    const original = window.cyrrenzaRefreshBackend;
    if (typeof original === "function" && !original.__opsWrapped) {
      const wrapped = async function() {
        const result = await original.apply(this, arguments);
        renderBackend(window.cyrrenzaBackendData || null);
        return result;
      };
      wrapped.__opsWrapped = true;
      window.cyrrenzaRefreshBackend = wrapped;
    }
    const bindAuth = () => {
      if (window.cyrrenzaSupabase?.auth) {
        window.cyrrenzaSupabase.auth.onAuthStateChange((event) => {
          setTimeout(()=>renderBackend(window.cyrrenzaBackendData||null), event === "SIGNED_IN" ? 900 : 0);
        });
        return true;
      }
      return false;
    };
    if (!bindAuth()) {
      let attempts = 0;
      const authWait = setInterval(() => {
        attempts += 1;
        if (bindAuth() || attempts >= 120) clearInterval(authWait);
      }, 500);
    }
    let dataAttempts = 0;
    const dataWait = setInterval(() => {
      dataAttempts += 1;
      if (window.cyrrenzaBackendData) renderBackend(window.cyrrenzaBackendData);
      if (dataAttempts >= 120) clearInterval(dataWait);
    }, 500);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
