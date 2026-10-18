import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"GET, OPTIONS","Content-Type":"application/json"};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status,headers:cors});
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok",{headers:cors});
  if (req.method !== "GET") return reply({error:"Method not allowed"},405);
  const url=Deno.env.get("SUPABASE_URL"), key=Deno.env.get("SUPABASE_ANON_KEY"), auth=req.headers.get("Authorization");
  if(!url||!key)return reply({error:"Backend configuration missing"},503);
  if(!auth?.startsWith("Bearer "))return reply({error:"Authentication required"},401);
  const sb=createClient(url,key,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:userError}=await sb.auth.getUser();
  if(userError||!user)return reply({error:"Invalid session"},401);
  const {data:profile,error:profileError}=await sb.from("admin_profiles").select("role,is_active").eq("user_id",user.id).maybeSingle();
  if(profileError)return reply({error:"Unable to verify admin authorization"},503);
  if(!profile?.is_active||!["admin","compliance","operations"].includes(profile.role))return reply({error:"Active privileged Cyrrenza MT5 admin access required"},403);
  const endpoint=Deno.env.get("MT5_ADAPTER_HEALTH_URL"), token=Deno.env.get("MT5_ADAPTER_TOKEN");
  if(!endpoint||!token)return reply({integration:"mt5_manager_api",status:"not_configured",authenticated:false,tradingEnabled:false,checkedAt:new Date().toISOString(),reason:"Secure adapter endpoint/token is not configured. Obtain authorized demo MT5 adapter details from the broker/MetaQuotes partner.",requiredSecrets:["MT5_ADAPTER_HEALTH_URL","MT5_ADAPTER_TOKEN"]});
  let target:URL;
  try {target=new URL(endpoint);if(target.protocol!=="https:"||target.username||target.password||target.search||target.hash)return reply({integration:"mt5_manager_api",status:"configured_unverified",authenticated:false,tradingEnabled:false,reason:"Adapter URL must be HTTPS without embedded credentials, query, or fragment."},503);}
  catch{return reply({integration:"mt5_manager_api",status:"configured_unverified",authenticated:false,tradingEnabled:false,reason:"Adapter health URL is invalid."},503);}
  const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),5000);
  try {
    const response=await fetch(target.toString(),{headers:{Authorization:"Bearer "+token,Accept:"application/json"},signal:controller.signal,redirect:"error"});
    if(!response.ok)return reply({integration:"mt5_manager_api",status:"degraded",authenticated:false,tradingEnabled:false,httpStatus:response.status,checkedAt:new Date().toISOString(),reason:"Adapter health endpoint did not return success; response body omitted."},502);
    const p=await response.json().catch(()=>null), authenticated=p?.authenticated===true, connected=p?.connected===true, platformOk=String(p?.platform??"").toLowerCase()==="mt5", demoOnly=String(p?.environment??"").toLowerCase()==="demo", healthy=authenticated&&connected&&platformOk&&demoOnly;
    return reply({integration:"mt5_manager_api",status:healthy?"healthy":"configured_unverified",authenticated,connected,platformVerified:platformOk,environment:demoOnly?"demo":"unverified",tradingEnabled:false,checkedAt:new Date().toISOString(),reason:healthy?"Adapter reports authenticated MT5 demo connection; trading remains disabled.":"Adapter did not prove authenticated=true, connected=true, platform=MT5, environment=demo."},healthy?200:503);
  } catch(e) {const timedOut=e instanceof DOMException&&e.name==="AbortError";return reply({integration:"mt5_manager_api",status:timedOut?"offline":"offline",authenticated:false,tradingEnabled:false,checkedAt:new Date().toISOString(),reason:timedOut?"Adapter health check timed out after 5 seconds.":"Adapter could not be reached. Verify network, TLS, allow-list, and adapter service."},502);}
  finally{clearTimeout(timeout);}
});