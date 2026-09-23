import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { cp, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {runNativeBrowserSmoke} from "./browser-native-smoke.mjs";

const root=fileURLToPath(new URL("../",import.meta.url));
const apiCwd=join(root,"apps/api");
const webCwd=join(root,"apps/web");
const apiOrigin="http://127.0.0.1:4000";
const webOrigin="http://127.0.0.1:3000";

function serverEntry(){
  const candidates=[
    join(webCwd,".next/standalone/apps/web/server.js"),
    join(webCwd,".next/standalone/server.js"),
  ];
  const match=candidates.find(path=>existsSync(path));
  if(!match)throw new Error("Next standalone server was not built: "+candidates.join(", "));
  return match;
}
async function prepareStandalone(){
  const entry=serverEntry();
  const standaloneApp=dirname(entry);
  const staticDir=join(webCwd,".next/static");
  assert.ok(existsSync(staticDir),"Build must generate Next.js browser assets");
  await mkdir(join(standaloneApp,".next"),{recursive:true});
  await cp(staticDir,join(standaloneApp,".next/static"),{recursive:true,force:true});
  const publicDir=join(webCwd,"public");
  if(existsSync(publicDir)){
    await cp(publicDir,join(standaloneApp,"public"),{recursive:true,force:true});
  }
  return entry;
}
function start(entry,cwd,env){
  const logs=[];
  const child=spawn(process.execPath,[entry],{cwd,env:{...process.env,...env},stdio:["ignore","pipe","pipe"]});
  child.stdout.on("data",data=>logs.push(data.toString()));
  child.stderr.on("data",data=>logs.push(data.toString()));
  return {child,logs};
}
async function ready(origin,path,proc){
  for(let attempt=0;attempt<100;attempt++){
    if(proc.child.exitCode!==null)throw new Error("Server exited:\n"+proc.logs.join(""));
    try{
      const response=await fetch(origin+path,{signal:AbortSignal.timeout(900)});
      if(response.ok)return;
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,160));
  }
  throw new Error("Server startup failed:\n"+proc.logs.join(""));
}
async function close(proc){
  proc.child.kill("SIGTERM");
  await Promise.race([
    new Promise(resolve=>proc.child.once("exit",resolve)),
    new Promise(resolve=>setTimeout(resolve,3000)),
  ]);
  if(proc.child.exitCode===null)proc.child.kill("SIGKILL");
}
function cookies(response){
  return response.headers.getSetCookie().map(value=>value.split(";")[0]).join("; ");
}
async function login(email){
  const response=await fetch(webOrigin+"/api/auth/login",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({email,password:"DealOS2026!"}),
  });
  assert.equal(response.status,201,email+" should sign in through the web rewrite");
  const cookie=cookies(response);
  assert.match(cookie,/dealos_session=/);
  return cookie;
}
async function page(path,cookie){
  const response=await fetch(webOrigin+path,{headers:cookie?{cookie}:undefined,
    signal:AbortSignal.timeout(10_000)});
  const body=await response.text();
  assert.equal(response.status,200,path+" returned "+response.status+": "+body.slice(0,700));
  assert.ok(body.includes("<!DOCTYPE html>")||body.includes("<html"),path+" did not render HTML");
  return body;
}

test("web routes render across the real API for 100 seeded businesses",{timeout:300_000},async t=>{
  const live=readFileSync(join(webCwd,"components/deal-live-updates.tsx"),"utf8");
  assert.ok(live.includes('"/api/deals/"'),"Live updates must use same-origin API routes");
  assert.ok(!live.includes("NEXT_PUBLIC_API_URL"),"Live updates must not require cross-domain auth cookies");

  const api=start("dist/main.js",apiCwd,{API_PORT:"4000"});
  t.after(async()=>close(api));
  await ready(apiOrigin,"/api/health",api);

  const web=start(await prepareStandalone(),webCwd,{PORT:"3000",HOSTNAME:"127.0.0.1",
    API_INTERNAL_URL:apiOrigin});
  t.after(async()=>close(web));
  await ready(webOrigin,"/",web);

  const marketplace=await page("/marketplace?q=KoraMetrics");
  assert.ok(marketplace.includes("KoraMetrics"));
  assert.ok(marketplace.includes("Find your next business"));
  const listing=await page("/marketplace/korametrics");
  assert.ok(listing.includes("KoraMetrics"));
  assert.ok(listing.includes("Asking price"));
  await page("/register");
  const loginHtml=await page("/login");
  const bundles=[...loginHtml.matchAll(/src="([^"]*\/_next\/static\/[^"]+\.js[^"]*)"/g)];
  assert.ok(bundles.length>0,"Login must include at least one client-side JavaScript bundle");
  const bundleResponse=await fetch(webOrigin+bundles[0][1].replaceAll("&amp;","&"));
  assert.equal(bundleResponse.status,200,"The production standalone server must serve its client bundle");
  assert.match(bundleResponse.headers.get("content-type")||"",/javascript/);

  const buyerCookie=await login("amara@northstar.capital");
  const buyerHome=await page("/dashboard",buyerCookie);
  assert.ok(buyerHome.includes("Amara"));
  assert.ok(buyerHome.includes("Your acquisitions"));
  const dealsResponse=await fetch(webOrigin+"/api/deals",{headers:{cookie:buyerCookie}});
  assert.equal(dealsResponse.status,200);
  const deals=await dealsResponse.json();
  assert.ok(deals.length>=3,"Seeded buyer should have multiple distinct acquisitions");
  const active=deals.filter(deal=>deal.stage!=="WITHDRAWN");
  assert.ok(new Set(active.map(deal=>deal.listingId)).size>=2);
  const first=await page("/deals/"+active[0].id,buyerCookie);
  assert.ok(first.includes(active[0].listing.name));
  const second=await page("/deals/"+active[1].id+"/documents",buyerCookie);
  assert.ok(second.includes(active[1].listing.name));
  const diligence=await page("/deals/"+active[1].id+"/diligence",buyerCookie);
  assert.ok(diligence.includes(active[1].listing.name));
  const escrow=active.find(deal=>deal.escrow);
  assert.ok(escrow);
  await page("/deals/"+escrow.id+"/escrow",buyerCookie);
  await page("/kyc",buyerCookie);
  await page("/kyc/identity",buyerCookie);
  await page("/deals/"+escrow.id+"/assets",buyerCookie);
  const wallet=await page("/wallet",buyerCookie);
  assert.ok(wallet.includes("Demo wallet"));

  const sellerCookie=await login("tunde@korametrics.example");
  const sellerListings=await page("/my-listings",sellerCookie);
  assert.ok(sellerListings.includes("KoraMetrics"));
  await page("/my-listings/korametrics",sellerCookie);
  await page("/my-listings/korametrics/verification",sellerCookie);
  await page("/my-listings/new",sellerCookie);
  await page("/kyc",sellerCookie);
  await page("/wallet",sellerCookie);
  await page("/deals",sellerCookie);
  const advisorCookie=await login("nia@dealos.example");
  await page("/reviews",advisorCookie);
  await page("/reviews/businesses/korametrics",advisorCookie);
  await page("/deals",advisorCookie);

  const withoutSession=await fetch(webOrigin+"/dashboard",{redirect:"manual"});
  assert.ok([302,303,307,308].includes(withoutSession.status),
    "Unauthenticated workspace route must redirect");
  await t.test("real Chromium validates complete buyer, seller, advisor and mobile journeys",async()=>{
    await runNativeBrowserSmoke();
  });
});
