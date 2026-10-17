(() => {
  "use strict";
  // Public, read-only Deriv market data. App ID 1089 is Deriv's documented test app ID.
  // No account token is used. This module cannot place trades or access balances.
  const ENDPOINT = "wss://ws.derivws.com/websockets/v3?app_id=1089";
  const SYMBOLS = ["frxEURUSD", "frxGBPUSD", "frxUSDJPY", "frxAUDUSD", "frxEURGBP", "frxXAUUSD"];
  const prices = new Map();
  let socket = null, reconnectTimer = null, started = false;
  const safe = value => String(value ?? "").replace(/[&<>"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
  const format = value => value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? "—" : Number(value).toLocaleString(undefined,{maximumFractionDigits:8});
  function setStatus(text, bad=false) {
    const node = document.getElementById("derivFeedStatus");
    if (node) { node.textContent=text; node.className="tag"; node.style.color=bad?"#ff7d8b":"#70e0bd"; }
  }
  function ensurePanel() {
    const section=document.getElementById("page-markets");
    if(!section || document.getElementById("derivMarketPanel")) return;
    const panel=document.createElement("div");
    panel.id="derivMarketPanel";
    panel.className="panel";
    panel.style.marginBottom="16px";
    panel.innerHTML='<div class="panelhead"><div><h2>Deriv public market stream</h2><p>Read-only live tick stream · not an order connection</p></div><span id="derivFeedStatus" class="tag">Connecting…</span></div><div class="panelbody"><div id="derivMarketRows" class="empty">Connecting to Deriv public market data…</div><p class="footnote">Public data uses Deriv test application ID 1089. Register a Cyrrenza-owned Deriv application ID before production use. No Deriv account token is stored or used here.</p></div>';
    const notice=section.querySelector(".notice");
    if(notice) notice.insertAdjacentElement("afterend",panel); else section.insertBefore(panel,section.firstChild);
  }
  function render() {
    ensurePanel();
    const rows=document.getElementById("derivMarketRows");
    if(rows) {
      const list=[...prices.values()].sort((a,b)=>a.symbol.localeCompare(b.symbol));
      rows.innerHTML=list.length?'<div class="tablewrap"><table><thead><tr><th>SYMBOL</th><th>LAST TICK</th><th>QUOTE TIME (UTC)</th><th>SOURCE</th><th>MODE</th></tr></thead><tbody>'+list.map(q=>'<tr><td><b>'+safe(q.display||q.symbol)+'</b><div class="pair">'+safe(q.symbol)+'</div></td><td>'+safe(format(q.quote))+'</td><td>'+safe(new Date(q.epoch*1000).toISOString().replace("T"," ").replace("Z",""))+'</td><td>Deriv</td><td><span class="status">Public feed</span></td></tr>').join("")+'</tbody></table></div>':'<div class="empty">Waiting for the first provider ticks. If no symbols arrive, verify Deriv availability and register a Cyrrenza application ID.</div>';
    }
    const marketTable=document.getElementById("marketTable");
    if(marketTable && prices.size) marketTable.innerHTML=[...prices.values()].sort((a,b)=>a.symbol.localeCompare(b.symbol)).map(q=>'<tr><td><b>'+safe(q.symbol)+'</b></td><td>Forex / commodity</td><td>'+safe(format(q.quote))+'</td><td>—</td><td><span class="status">Deriv public feed</span></td></tr>').join("");
    const mini=document.getElementById("miniMarkets");
    if(mini && prices.size) mini.innerHTML=[...prices.values()].slice(0,5).map(q=>'<div class="market"><div><div class="symbol">'+safe(q.symbol)+'</div><div class="pair">Deriv public tick</div></div><div class="price">'+safe(format(q.quote))+'</div><div class="change">Live tick</div></div>').join("");
  }
  function connect() {
    if(socket && (socket.readyState===WebSocket.OPEN || socket.readyState===WebSocket.CONNECTING)) return;
    ensurePanel(); setStatus("Connecting…");
    try { socket=new WebSocket(ENDPOINT); } catch(e) { setStatus("Connection failed",true); return; }
    socket.onopen=()=>{
      setStatus("Connected · waiting for ticks");
      socket.send(JSON.stringify({active_symbols:"brief",product_type:"basic",req_id:1}));
      socket.send(JSON.stringify({ping:1,req_id:99}));
    };
    socket.onmessage=event=>{
      let msg; try { msg=JSON.parse(event.data); } catch { return; }
      if(msg.error) { setStatus("Provider error",true); return; }
      if(msg.msg_type==="active_symbols" && Array.isArray(msg.active_symbols)) {
        const active=new Set(msg.active_symbols.map(s=>s.symbol));
        const chosen=SYMBOLS.filter(s=>active.has(s));
        if(!chosen.length) {
          const forex=msg.active_symbols.filter(s=>String(s.market).toLowerCase().includes("forex") && s.exchange_is_open!==false).slice(0,6);
          forex.forEach(s=>{if(!prices.has(s.symbol))prices.set(s.symbol,{symbol:s.symbol,display:s.display_name||s.symbol,quote:null,epoch:Math.floor(Date.now()/1000)});});
          if(forex.length) forex.forEach(s=>socket.send(JSON.stringify({ticks:s.symbol,subscribe:1})));
          render(); return;
        }
        chosen.forEach(symbol=>{const meta=msg.active_symbols.find(s=>s.symbol===symbol); if(!prices.has(symbol))prices.set(symbol,{symbol,display:meta?.display_name||symbol,quote:null,epoch:Math.floor(Date.now()/1000)});socket.send(JSON.stringify({ticks:symbol,subscribe:1}));});
        render();
      }
      if(msg.msg_type==="tick" && msg.tick) {
        const t=msg.tick, symbol=t.symbol;
        if(!symbol)return;
        const meta=prices.get(symbol)||{symbol,display:symbol};
        prices.set(symbol,{...meta,quote:Number(t.quote),epoch:Number(t.epoch)||Math.floor(Date.now()/1000)});
        setStatus("Receiving ticks · "+prices.size+" symbols");
        render();
      }
    };
    socket.onerror=()=>setStatus("Feed connection error",true);
    socket.onclose=()=>{setStatus("Disconnected · retrying",true);socket=null;clearTimeout(reconnectTimer);reconnectTimer=setTimeout(connect,5000);};
  }
  function start() { if(started)return; started=true; connect(); }
  document.addEventListener("DOMContentLoaded",()=>{ensurePanel();start();});
  if(document.readyState!=="loading"){ensurePanel();start();}
  document.addEventListener("visibilitychange",()=>{if(!document.hidden && (!socket || socket.readyState===WebSocket.CLOSED))connect();});
})();