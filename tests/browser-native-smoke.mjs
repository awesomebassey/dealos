import assert from "node:assert/strict";
import {runCompleteJourney} from "./browser-complete-journey.mjs";
import {spawn} from "node:child_process";
import {existsSync} from "node:fs";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const origin="http://127.0.0.1:3000";
class Devtools {
  constructor(socket){
    this.socket=socket;this.seq=0;this.pending=new Map();
    socket.addEventListener("message",event=>{
      const item=JSON.parse(event.data);
      const callback=this.pending.get(item.id);
      if(!callback)return;
      this.pending.delete(item.id);
      if(item.error)callback.reject(new Error(item.error.message));
      else callback.resolve(item.result);
    });
  }
  static async connect(url){
    const socket=new WebSocket(url);
    await new Promise((resolve,reject)=>{
      socket.addEventListener("open",resolve,{once:true});
      socket.addEventListener("error",reject,{once:true});
    });
    return new Devtools(socket);
  }
  send(method,params={}){
    const id=++this.seq;
    return new Promise((resolve,reject)=>{
      this.pending.set(id,{resolve,reject});
      this.socket.send(JSON.stringify({id,method,params}));
    });
  }
  close(){this.socket.close();}
}
async function until(callback,label,timeout=16000){
  const stop=Date.now()+timeout;
  let last;
  while(Date.now()<stop){
    try{const result=await callback();if(result)return result;}catch(error){last=error;}
    await wait(120);
  }
  throw new Error("Browser timeout: "+label+(last?"; "+last.message:""));
}
function jsString(value){return JSON.stringify(value);}
class BrowserPage {
  constructor(target,session){
    this.target=target;this.cdp=session;
  }
  async activate(){
    // Chrome opens three isolated tabs. Real input events must target the
    // active tab rather than the background tab left behind by target creation.
    await this.cdp.send("Page.bringToFront");
  }
  async hydration(selector){
    await until(()=>this.eval(
      "(()=>{const el=document.querySelector("+jsString(selector)+");return !!el && Object.keys(el).some(key=>key.startsWith('__reactProps'))})()"
    ),"React hydration for "+selector,20000);
  }
  async diagnostic(){
    return this.eval("(()=>({path:location.pathname,ready:document.readyState,body:document.body.innerText.slice(-1000),"+
      "form:[...document.querySelectorAll('form')].map(f=>({action:f.action,buttons:[...f.querySelectorAll('button')].map(b=>"+
      "({label:b.textContent.trim(),disabled:b.disabled,hydrated:Object.keys(b).some(k=>k.startsWith('__reactProps'))})),inputs:"+
      "[...f.querySelectorAll('input')].map(i=>({name:i.name,filled:!!i.value,valid:i.validity.valid}))})),"+
      "requests:(window.__dealosRequests||[]).slice(-30)}))()");
  }
  async eval(expression){
    const result=await this.cdp.send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails)throw new Error(result.exceptionDetails.text);
    return result.result.value;
  }
  async goto(path){
    await this.activate();
    await this.cdp.send("Page.navigate",{url:origin+path});
    await until(()=>this.eval("document.readyState === 'complete' && location.pathname === "+jsString(new URL(origin+path).pathname)),"navigate "+path);
    await wait(350);
  }
  async findButton(label){
    return this.eval("(()=>{const matches=[...document.querySelectorAll('button')].filter(el=>el.textContent.trim()==="+jsString(label)+" && el.getBoundingClientRect().width>0);return matches.length})()");
  }
  async click(selector,at=0){
    await this.activate();
    const pos=await this.eval("(()=>{const items=[...document.querySelectorAll("+jsString(selector)+")].filter(el=>el.getBoundingClientRect().width>0 && el.getBoundingClientRect().height>0);const node=items["+at+"];if(!node)return null;node.scrollIntoView({block:'center'});const r=node.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()");
    if(!pos)throw new Error("Browser control not found: "+selector+" index "+at);
    await this.cdp.send("Input.dispatchMouseEvent",{type:"mouseMoved",x:pos.x,y:pos.y});
    await this.cdp.send("Input.dispatchMouseEvent",{type:"mousePressed",x:pos.x,y:pos.y,button:"left",clickCount:1});
    await this.cdp.send("Input.dispatchMouseEvent",{type:"mouseReleased",x:pos.x,y:pos.y,button:"left",clickCount:1});
  }
  async button(label,at=0){
    await this.activate();
    // Wait until Next.js attaches the React event handler to this button.
    const match="(()=>{const list=[...document.querySelectorAll('button')].filter(el=>el.textContent.trim()==="+
      jsString(label)+" && el.getBoundingClientRect().width>0);const el=list["+at+"];"+
      "if(!el)return null;el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();"+
      "return {hydrated:Object.keys(el).some(key=>key.startsWith('__reactProps')),"+
      "x:r.left+r.width/2,y:r.top+r.height/2}})()";
    const pos=await until(async()=>{
      const result=await this.eval(match);
      return result?.hydrated ? result : null;
    },"hydrated button "+label,20000);
    await this.cdp.send("Input.dispatchMouseEvent",{type:"mouseMoved",x:pos.x,y:pos.y});
    await this.cdp.send("Input.dispatchMouseEvent",{type:"mousePressed",x:pos.x,y:pos.y,button:"left",clickCount:1});
    await this.cdp.send("Input.dispatchMouseEvent",{type:"mouseReleased",x:pos.x,y:pos.y,button:"left",clickCount:1});
  }
  async fill(selector,value){
    await this.activate();
    const found=await this.eval("(()=>{const el=document.querySelector("+jsString(selector)+");if(!el)return false;el.focus();el.select();return true})()");
    if(!found)throw new Error("Input not found: "+selector);
    await this.cdp.send("Input.insertText",{text:value});
  }
  async textIncludes(content){
    return this.eval("document.body.innerText.includes("+jsString(content)+")");
  }
  async fetch(path){
    return this.eval("(async()=>{const r=await fetch("+jsString("/api"+path)+",{credentials:'include'});return {status:r.status,body:await r.json()}})()");
  }
}
async function newPage(browser,debuggerOrigin){
  const {browserContextId}=await browser.send("Target.createBrowserContext");
  const {targetId}=await browser.send("Target.createTarget",{url:"about:blank",browserContextId});
  const details=await until(async()=>{
    const r=await fetch(debuggerOrigin+"/json/list");
    return (await r.json()).find(item=>item.id===targetId&&item.webSocketDebuggerUrl);
  },"browser target");
  const session=await Devtools.connect(details.webSocketDebuggerUrl);
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  // Record only API response codes and synthetic review errors. This identifies
  // whether a browser click actually sent a request without exposing cookies.
  await session.send("Page.addScriptToEvaluateOnNewDocument",{source:`
    (() => {
      window.__dealosRequests = [];
      const original = window.fetch.bind(window);
      window.fetch = async (...args) => {
        const response = await original(...args);
        try {
          const request = args[0];
          const url = new URL(typeof request === 'string' ? request : request.url, location.href);
          if (url.pathname.startsWith('/api/')) {
            const method = (args[1]?.method || request?.method || 'GET').toUpperCase();
            const item = {path:url.pathname,method,status:response.status};
            window.__dealosRequests.push(item);
            if (window.__dealosRequests.length > 80) window.__dealosRequests.shift();
            if (!response.ok && url.pathname.includes('/review')) {
              response.clone().text().then(body => {item.error = body.slice(0,400)}).catch(() => {});
            }
          }
        } catch {}
        return response;
      };
    })();
  `});
  return new BrowserPage(targetId,session);
}
async function signIn(page,email,password){
  await page.goto("/login");
  // Wait for React's event handlers before interacting with controlled forms.
  // Input or button clicks against server markup can otherwise be lost.
  await page.hydration('form button');
  await page.fill("#login-email",email);
  await page.fill("#login-password",password);
  await page.button("Sign in");
  try{
    await until(()=>page.eval("location.pathname === '/dashboard'"),"first-party sign-in",22000);
  }catch(error){
    const diagnostics=await page.diagnostic().catch(e=>({error:e.message}));
    throw new Error(error.message+"; page state: "+JSON.stringify(diagnostics));
  }
}
export async function runNativeBrowserSmoke(){
  const chrome=[process.env.CHROME_PATH,"/usr/bin/google-chrome","/usr/bin/google-chrome-stable",
    "/usr/bin/chromium","/usr/bin/chromium-browser"].find(p=>p&&existsSync(p));
  if(!chrome)throw new Error("Real-browser CI requires Chromium or Chrome (set CHROME_PATH)");
  const profile=await mkdtemp(join(tmpdir(),"dealos-browser-"));
  const proc=spawn(chrome,["--headless=new","--no-sandbox","--disable-dev-shm-usage",
    "--disable-gpu","--remote-debugging-port=0","--user-data-dir="+profile,"about:blank"],{
    stdio:["ignore","ignore","pipe"],
  });
  let output="";
  proc.stderr.on("data",chunk=>{output+=String(chunk);});
  let browser;
  try{
    const ws=await until(()=>{
      const match=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if(proc.exitCode!==null)throw new Error("Browser exited: "+output.slice(-800));
      return match?.[1];
    },"Chrome remote debugger");
    const url=new URL(ws);
    const debuggerOrigin="http://"+url.host;
    browser=await Devtools.connect(ws);
    const buyer=await newPage(browser,debuggerOrigin);
    const seller=await newPage(browser,debuggerOrigin);
    const advisor=await newPage(browser,debuggerOrigin);
    const password=process.env.DEALOS_SMOKE_DEMO_PASSWORD;
    assert.ok(password);
    await buyer.goto("/marketplace?q=KoraMetrics");
    assert.ok(await buyer.textIncludes("KoraMetrics"),"Marketplace missing seeded listing");
    await signIn(buyer,"amara@northstar.capital",password);
    await until(()=>buyer.textIncludes("Amara"),"Buyer dashboard");
    await buyer.goto("/marketplace/sample-business-004");
    await buyer.button("Start acquisition");
    await until(()=>buyer.eval("location.pathname.startsWith('/deals/') && location.pathname.split('/').length===3"),"buyer deal navigation");
    const dealId=(await buyer.eval("location.pathname")).split("/")[2];
    assert.ok(dealId);
    await buyer.button("Review and sign sample NDA");
    await until(()=>buyer.eval("document.querySelector('[role=checkbox]')!==null"),"NDA checkbox");
    await buyer.click('[role="checkbox"]');
    await buyer.button("Confirm");
    await until(async()=>{
      const result=await buyer.fetch("/deals/"+dealId);
      return result.status===200&&result.body.stage==="DILIGENCE";
    },"NDA signing");
    await buyer.goto("/deals/"+dealId+"/documents");
    assert.ok(await buyer.textIncludes("Illustrative revenue 004.csv"),"Confidential room unavailable");
    await buyer.button("Open");
    await until(()=>buyer.eval("document.body.innerText.includes('Document access granted')"),"Data room access dialog");
    const download=await buyer.eval("document.querySelector('a[href*=download]')?.getAttribute('href')");
    assert.ok(download?.includes("dealId="+dealId),"Document URL not tied to selected deal");
    const walletBefore=await buyer.fetch("/wallet");
    assert.equal(walletBefore.status,200);
    await buyer.goto("/wallet");
    await buyer.button("Add simulated funds");
    await until(()=>buyer.eval("document.querySelector('#demo-amount')!==null"),"Demo top-up form");
    await buyer.fill("#demo-amount","150000");
    await buyer.button("Credit demo balance");
    await until(async()=>{
      const state=await buyer.fetch("/wallet");
      return BigInt(state.body.balanceMinor)>=BigInt(walletBefore.body.balanceMinor)+15000000n;
    },"Demo wallet credited");
    await signIn(seller,"tunde@korametrics.example",password);
    await seller.goto("/my-listings");
    assert.ok(await seller.textIncludes("KoraMetrics"),"Seller listings missing");
    await seller.goto("/my-listings/korametrics/verification");
    assert.ok(await seller.textIncludes("Business registration"),"Seller verification route missing");
    await signIn(advisor,"nia@dealos.example",password);
    await advisor.goto("/reviews");
    assert.ok(await advisor.textIncludes("Verification reviews"),"Advisor review queue missing");
    await advisor.goto("/deals/"+dealId+"/diligence");
    await advisor.button("Refresh diligence review");
    await until(async()=>{
      const data=await advisor.fetch("/diligence/deals/"+dealId);
      return data.status===200&&data.body.findings.length>0;
    },"Advisor diligence action");
    await buyer.cdp.send("Emulation.setDeviceMetricsOverride",{
      width:390,height:844,deviceScaleFactor:1,mobile:true,
    });
    await buyer.goto("/marketplace");
    const overflow=await buyer.eval("document.documentElement.scrollWidth-window.innerWidth");
    assert.ok(overflow<=2,"Mobile marketplace horizontal overflow: "+overflow+"px");
    assert.ok(await buyer.textIncludes("Find your next business"),"Mobile marketplace inaccessible");
    console.log("PASS: Chromium buyer actions, seller workspace, advisor diligence and mobile layout");
    await runCompleteJourney({browser,debuggerOrigin,newPage,until,password});
    buyer.cdp.close();seller.cdp.close();advisor.cdp.close();
  }finally{
    browser?.close();
    proc.kill("SIGTERM");
    await rm(profile,{recursive:true,force:true}).catch(()=>undefined);
  }
}
