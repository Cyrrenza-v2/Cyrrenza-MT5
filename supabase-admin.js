(() => {
  "use strict";
  const URL = "https://mvxhpddjtctpvrurqnpg.supabase.co";
  const KEY = "sb_publishable_kDtqPySaFV__kndlgY9p3w_Xw20AJBy";
  const style = document.createElement("style");
  style.textContent = "#cyAuthGate{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:#080e19;padding:20px}#cyAuthCard{width:min(420px,100%);padding:26px;border:1px solid #223047;border-radius:16px;background:#101a2a;color:#edf3fc;font:14px/1.45 system-ui}#cyAuthCard h1{margin:0 0 8px;font-size:22px}#cyAuthCard p{color:#8da0b9;font-size:13px}#cyAuthCard label{display:block;margin:14px 0 6px;color:#a8b8ce;font-size:12px}#cyAuthCard input{width:100%;padding:11px;border-radius:8px;border:1px solid #223047;background:#0b1422;color:#edf3fc;box-sizing:border-box}#cyAuthCard button{margin-top:14px;width:100%;padding:11px;border-radius:8px;border:1px solid #70e0bd;background:#70e0bd;color:#07151b;font-weight:700}#cyAuthMessage{min-height:20px;color:#f5c56a;font-size:12px;margin-top:10px}";
  document.head.appendChild(style);
  const gate = document.createElement("div");
  gate.id = "cyAuthGate";
  gate.innerHTML = '<div id="cyAuthCard"><div style="color:#70e0bd;font-size:10px;letter-spacing:.17em;font-weight:700">CYRRENZA MT5 · SECURE ADMIN</div><h1>Administrator sign in</h1><p>Sign in using a Supabase Auth account explicitly enabled in the Cyrrenza MT5 admin profile. This page cannot promote accounts to admin.</p><form id="cyAuthForm"><label for="cyAuthEmail">Admin email</label><input id="cyAuthEmail" type="email" autocomplete="username" required maxlength="254"><label for="cyAuthPassword">Password</label><input id="cyAuthPassword" type="password" autocomplete="current-password" required><button id="cyAuthSubmit">Sign in securely</button></form><div id="cyAuthMessage" role="status"></div><p>Live quotes and trade execution remain disabled until a real provider connection is configured.</p></div>';
  document.body.appendChild(gate);
  const msg = document.getElementById("cyAuthMessage"), form = document.getElementById("cyAuthForm"), submit = document.getElementById("cyAuthSubmit");
  const say = s => msg.textContent = s;
  const safe = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const loadScript = () => new Promise((resolve,reject) => {
    if (window.supabase?.createClient) return resolve();
    const s=document.createElement("script"); s.src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"; s.onload=resolve; s.onerror=reject; document.head.appendChild(s);
  });
  loadScript().then(() => {
    const sb = window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true}});
    window.cyrrenzaSupabase=sb;
    async function request(resource, token) {
      const res=await fetch(URL+"/functions/v1/admin-api?resource="+encodeURIComponent(resource),{headers:{Authorization:"Bearer "+token,apikey:KEY}});
      const body=await res.json().catch(()=>({}));
      if(!res.ok) throw Object.assign(new Error(body.error||"Backend request failed"),{status:res.status});
      return body;
    }
    async function connect(session) {
      if(!session?.access_token){gate.style.display="grid";return;}
      say("Verifying Cyrrenza MT5 admin access…");
      try {
        const status=await request("status",session.access_token);
        const [clientRes,accountRes,instrumentRes,quoteRes]=await Promise.all([request("clients",session.access_token),request("accounts",session.access_token),request("instruments",session.access_token),request("quotes",session.access_token)]);
        const clients=clientRes.data||[],accounts=accountRes.data||[],instruments=instrumentRes.data||[],quotes=quoteRes.data||[];
        window.cyrrenzaBackendData={clients,accounts,instruments,quotes,status};
        const clientTable=document.getElementById("clientTable");
        if(clientTable) clientTable.innerHTML=clients.map(c=>{const a=accounts.find(x=>x.client_id===c.id)||{};return '<tr><td><b>'+safe(c.display_name)+'</b><div class="pair">'+safe(c.email||"")+'</div></td><td>'+safe(a.broker_login||"Not linked")+'</td><td>'+safe(c.country_code||"—")+'</td><td>'+safe(c.onboarding_status)+'</td><td>'+safe(a.lifecycle_status||"No account")+'</td><td><span class="tag">Backend</span></td></tr>'}).join("")||'<tr><td colspan="6" class="empty">No client records in Supabase.</td></tr>';
        const count=document.getElementById("clientCount");if(count)count.textContent=clients.length+" backend client(s)";
        const renderInstrument=i=>{const q=quotes.find(x=>x.symbol===i.symbol);const fresh=q&&q.observed_at&&(Date.now()-new Date(q.observed_at).getTime()<=60000);const verified=!!(q&&q.is_live===true&&fresh&&Number.isFinite(Number(q.bid))&&Number.isFinite(Number(q.ask))&&Number(q.bid)>0&&Number(q.ask)>=Number(q.bid));return '<tr><td><b>'+safe(i.symbol)+'</b><div class="pair">'+safe(i.display_name)+'</div></td><td>'+safe(i.asset_class)+'</td><td>'+(q?safe(q.bid??"—")+' / '+safe(q.ask??"—"):'—')+'</td><td>—</td><td><span class="status '+(verified?'':'pending')+'">'+(verified?'Provider quote · verify source':(i.enabled?'No verified live quote':'Disabled · provider pending'))+'</span></td></tr>';};
        const marketTable=document.getElementById("marketTable");if(marketTable)marketTable.innerHTML=instruments.map(renderInstrument).join("")||'<tr><td colspan="5" class="empty">No instruments configured. Live quotes need a verified feed.</td></tr>';
        const mini=document.getElementById("miniMarkets");if(mini)mini.innerHTML=instruments.slice(0,5).map(i=>'<div class="market"><div><div class="symbol">'+safe(i.symbol)+'</div><div class="pair">'+safe(i.display_name)+'</div></div><div class="price">—</div><div class="change">Not live</div></div>').join("")||'<div class="empty">No verified live feed connected.</div>';
        const marketNotice=document.querySelector("#page-markets .notice");if(marketNotice)marketNotice.textContent=quotes.length?"Instrument catalogue and stored provider quotes loaded from Supabase. Confirm provider health and quote freshness before treating any quote as live.":"Instrument catalogue loaded from Supabase. No stored quotes are available; prices are intentionally blank.";
        const clientSub=document.querySelector("#page-clients .sub");if(clientSub)clientSub.textContent="Client and account data loaded from the authenticated Cyrrenza MT5 backend.";
        const values=document.querySelectorAll("#page-overview .stat .value");if(values[0])values[0].textContent=accounts.length;if(values[3])values[3].textContent=clients.filter(c=>["pending","in_review"].includes(c.onboarding_status)).length;
        const overviewNotice=document.querySelector("#page-overview .notice");if(overviewNotice)overviewNotice.textContent="Connected to Cyrrenza MT5 Supabase. Market prices are not live until a verified broker/data feed is configured.";
        const env=document.querySelector(".env");if(env)env.textContent="BACKEND CONNECTED · TRADING OFF";
        let signOut=document.getElementById("cySignOut");if(!signOut){signOut=document.createElement("button");signOut.id="cySignOut";signOut.className="btn";signOut.type="button";signOut.textContent="Sign out";document.querySelector(".topright")?.appendChild(signOut);signOut.addEventListener("click",async()=>{signOut.disabled=true;try{await sb.auth.signOut();gate.style.display="grid";say("You have signed out.");}finally{signOut.disabled=false;}});}
        const side=document.querySelector(".sidefoot");if(side)side.innerHTML='<span class="dot"></span><b style="font-size:11px">Supabase connected</b><small>Authenticated admin · trading disabled</small>';
        gate.style.display="none";
      } catch(e) {
        if(e.status===401 || e.status===403) {
          await sb.auth.signOut();
          gate.style.display="grid";
          say(e.status===403?"This account is not an active Cyrrenza MT5 admin. Ask the project owner to authorize the profile.":"Your session expired. Please sign in again.");
        } else {
          gate.style.display="grid";
          say("Sign-in is retained, but the secured backend is temporarily unavailable. Refresh the page to retry. "+(e.message||""));
        }
      }
    }
    form.addEventListener("submit",async e=>{e.preventDefault();submit.disabled=true;submit.textContent="Verifying…";say("");try{const {data,error}=await sb.auth.signInWithPassword({email:document.getElementById("cyAuthEmail").value.trim(),password:document.getElementById("cyAuthPassword").value});if(error)throw error;await connect(data.session)}catch(e){say(e.message||"Sign in failed.")}finally{submit.disabled=false;submit.textContent="Sign in securely"}});
    window.cyrrenzaRefreshBackend=async()=>{const {data}=await sb.auth.getSession();if(data?.session)return connect(data.session);gate.style.display="grid";say("Sign in to refresh secured backend data.");};
    sb.auth.getSession().then(({data})=>data.session?connect(data.session):(gate.style.display="grid"));
    sb.auth.onAuthStateChange(event=>{if(event==="SIGNED_OUT")gate.style.display="grid"});
  }).catch(()=>say("Could not load secure sign-in library. Check internet and refresh."));
})();