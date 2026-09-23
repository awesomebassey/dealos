import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {existsSync} from "node:fs";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import test from "node:test";
import {chromium} from "playwright";

const root=fileURLToPath(new URL("../",import.meta.url));
const apiDir=join(root,"apps/api");
const webDir=join(root,"apps/web");
const origin="http://127.0.0.1:3000";
const password=process.env.DEALOS_SMOKE_DEMO_PASSWORD;
if(!password)throw new Error("DEALOS_SMOKE_DEMO_PASSWORD is required for disposable browser tests");
const pdf=Buffer.from("%PDF-1.4\n% Fabricated DealOS browser evidence, no real identities\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");
const suffix=Date.now().toString(36);

function start(entry,cwd,env){
  const logs=[];
  const child=spawn(process.execPath,[entry],{cwd,env:{...process.env,...env},stdio:["ignore","pipe","pipe"]});
  child.stdout.on("data",data=>logs.push(String(data)));
  child.stderr.on("data",data=>logs.push(String(data)));
  return {child,logs};
}
async function ready(url,proc){
  for(let i=0;i<120;i++){
    if(proc.child.exitCode!==null)throw new Error("Server exited: "+proc.logs.join("").slice(-5000));
    try{const r=await fetch(url,{signal:AbortSignal.timeout(800)});if(r.ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,180));
  }
  throw new Error("Server did not start: "+proc.logs.join("").slice(-5000));
}
async function close(proc){
  if(proc.child.exitCode!==null)return;
  proc.child.kill("SIGTERM");
  await Promise.race([new Promise(resolve=>proc.child.once("exit",resolve)),new Promise(resolve=>setTimeout(resolve,2500))]);
  if(proc.child.exitCode===null)proc.child.kill("SIGKILL");
}
function serverEntry(){
  const candidates=[join(webDir,".next/standalone/apps/web/server.js"),join(webDir,".next/standalone/server.js")];
  const found=candidates.find(existsSync);
  if(!found)throw new Error("Missing production standalone server: "+candidates.join(", "));
  return found;
}
async function visit(page,path){
  const r=await page.goto(origin+path,{waitUntil:"load",timeout:20000});
  assert.equal(r.status(),200,"Page failed: "+path);
}
async function api(page,path){
  const response=await page.context().request.get(origin+"/api"+path);
  assert.equal(response.status(),200,"GET "+path+" failed: "+(await response.text()).slice(0,350));
  return response.json();
}
async function register(page,role,name,email){
  await visit(page,"/register?account="+role);
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("checkbox").click();
  await page.getByRole("button",{name:"Create account"}).click();
  await page.waitForURL("**/dashboard",{timeout:20000});
}
async function login(page,email){
  await visit(page,"/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button",{name:"Sign in",exact:true}).click();
  await page.waitForURL("**/dashboard",{timeout:20000});
}
async function upload(form,category){
  await form.locator('input[type="file"]').setInputFiles({
    name:"fabricated-"+category+".pdf",mimeType:"application/pdf",buffer:pdf,
  });
  await form.getByRole("button",{name:"Submit for review"}).click();
  await form.getByRole("button",{name:"Submit for review"}).waitFor({state:"visible"});
}
async function reviewIdentity(advisor,email){
  await visit(advisor,"/reviews");
  const row=advisor.getByRole("row").filter({hasText:email});
  await row.getByRole("link",{name:"Review identity"}).click();
  const link=advisor.getByRole("link",{name:/Open .*\.pdf/}).last();
  const file=await advisor.context().request.get(origin+await link.getAttribute("href"));
  assert.equal(file.status(),200,"Advisor could not inspect submitted identity sample");
  await advisor.getByRole("button",{name:"Approve demo evidence"}).click();
  await advisor.getByRole("button",{name:"Confirm demo review"}).click();
  await advisor.getByRole("button",{name:"Approve demo evidence"}).waitFor({state:"hidden"});
}
async function submitCategory(seller,slug,title,types){
  await visit(seller,"/my-listings/"+slug+"/verification");
  const region=seller.locator("section.card").filter({has:seller.getByRole("heading",{name:title})});
  const form=region.locator("form");
  for(const [option,name] of types){
    if(option){
      await form.getByRole("combobox").click();
      await seller.getByRole("option",{name:option}).click();
    }
    await upload(form,name);
    await region.getByText("Submitted",{exact:true}).first().waitFor();
  }
}
async function reviewCategory(advisor,slug,title){
  await visit(advisor,"/reviews/businesses/"+slug);
  const region=advisor.locator("section.card").filter({has:advisor.getByRole("heading",{name:title})});
  const links=region.getByRole("link",{name:"Open document"});
  const count=await links.count();
  assert.ok(count>0,"No "+title+" documents");
  for(let i=0;i<count;i++){
    const href=await links.nth(i).getAttribute("href");
    const file=await advisor.context().request.get(origin+href);
    assert.equal(file.status(),200,"Advisor could not inspect "+title+" evidence");
  }
  await region.getByRole("button",{name:"Approve documents"}).click();
  await advisor.getByRole("button",{name:"Confirm review"}).click();
  await region.getByText("Approved",{exact:true}).first().waitFor();
}
async function stage(advisor,dealId,destination){
  await visit(advisor,"/deals/"+dealId);
  await advisor.getByRole("button",{name:"Move to "+destination}).click();
  await advisor.getByRole("button",{name:"Confirm",exact:true}).click();
  await advisor.waitForFunction(expected=>
    [...document.querySelectorAll("section.card .status.active")].some(el=>el.textContent?.trim().toLowerCase()===expected),
    destination,{timeout:15000});
}
async function confirmAssets(page,dealId){
  await visit(page,"/deals/"+dealId+"/assets");
  for(let remaining=5;remaining>0;remaining--){
    const buttons=page.getByRole("button",{name:"Confirm my side"});
    assert.equal(await buttons.count(),remaining,"Unconfirmed transfer checklist changed");
    await buttons.first().click();
    await page.waitForFunction(expected=>
      [...document.querySelectorAll("button")].filter(el=>el.textContent?.trim()==="Confirm my side").length===expected,
      remaining-1,{timeout:15000});
  }
}
async function escrowAction(page,dealId,label){
  await visit(page,"/deals/"+dealId+"/escrow");
  await page.getByRole("button",{name:label}).click();
  await page.getByRole("button",{name:"Confirm",exact:true}).click();
  await page.getByRole("button",{name:label}).waitFor({state:"hidden",timeout:15000});
}

test("real Chromium buyer, seller and advisor acquisition from registration to settlement",{
  timeout:300_000,
},async t=>{
  const apiProcess=start("dist/main.js",apiDir,{API_PORT:"4000"});
  t.after(async()=>close(apiProcess));
  await ready("http://127.0.0.1:4000/api/health",apiProcess);
  const webProcess=start(serverEntry(),webDir,{PORT:"3000",HOSTNAME:"127.0.0.1",API_INTERNAL_URL:"http://127.0.0.1:4000"});
  t.after(async()=>close(webProcess));
  await ready(origin+"/",webProcess);
  const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  t.after(async()=>browser.close());
  const sellerContext=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:900}});
  const buyerContext=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:900}});
  const advisorContext=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:900}});
  const seller=await sellerContext.newPage(),buyer=await buyerContext.newPage(),advisor=await advisorContext.newPage();
  for(const [label,page] of [["seller",seller],["buyer",buyer],["advisor",advisor]]){
    page.on("pageerror",err=>console.error(label+" browser exception: "+err.message));
  }
  const sellerEmail="browser-seller-"+suffix+"@example.test";
  const buyerEmail="browser-buyer-"+suffix+"@example.test";
  const business="Browser Acquisition "+suffix;
  let listing,deal;
  try{
    await t.test("first-party signup and reviewer identity decisions",async()=>{
      await register(seller,"SELLER","Browser Seller",sellerEmail);
      await register(buyer,"BUYER","Browser Buyer",buyerEmail);
      await login(advisor,"nia@dealos.example");
      await visit(seller,"/kyc/identity");
      await upload(seller.locator("form").filter({has:seller.getByRole("heading",{name:"Submit documents"})}),"identity");
      await visit(buyer,"/kyc/identity");
      await upload(buyer.locator("form").filter({has:buyer.getByRole("heading",{name:"Submit documents"})}),"identity");
      await reviewIdentity(advisor,sellerEmail);
      await reviewIdentity(advisor,buyerEmail);
      assert.equal((await api(seller,"/kyc/me")).identityVerified,true);
      assert.equal((await api(buyer,"/kyc/me")).identityVerified,true);
    });
    await t.test("seller UI: draft, five independent samples, reviewer approval and publication",async()=>{
      await visit(seller,"/my-listings/new");
      await seller.getByLabel("Business name").fill(business);
      await seller.getByLabel("Asking price in Naira").fill("2000000");
      await seller.getByLabel("Annual revenue in Naira").fill("1000000");
      await seller.getByLabel("Recurring revenue percent").fill("75");
      await seller.getByLabel("Largest customer revenue percent").fill("45");
      await seller.getByLabel("Revenue growth percent").fill("7");
      await seller.getByLabel("Owner hours per week").fill("15");
      await seller.getByRole("checkbox").first().click();
      await seller.getByRole("button",{name:"Create business draft"}).click();
      await seller.waitForURL(/\/my-listings\/[^/]+$/,{timeout:20000});
      const mine=await api(seller,"/listings/mine");
      listing=mine.find(item=>item.name===business);
      assert.ok(listing);
      await submitCategory(seller,listing.slug,"Business registration",[
        [null,"cac"],["Business ownership","ownership"],["Business address","address"],
      ]);
      await submitCategory(seller,listing.slug,"Revenue evidence",[
        [null,"bank"],["Profit and loss","profit-loss"],
      ]);
      await reviewCategory(advisor,listing.slug,"Business registration");
      await reviewCategory(advisor,listing.slug,"Revenue evidence");
      await visit(seller,"/my-listings/"+listing.slug);
      await seller.locator('input[type="file"]').setInputFiles({
        name:"fabricated-revenue.pdf",mimeType:"application/pdf",buffer:pdf,
      });
      await seller.getByRole("button",{name:"Add document"}).click();
      await seller.getByText("fabricated-revenue.pdf").first().waitFor();
      await seller.getByRole("button",{name:"Publish business"}).first().click();
      await seller.getByRole("link",{name:"View public listing"}).waitFor();
    });
    await t.test("buyer UI: browse, NDA, protected documents and independent offer",async()=>{
      await visit(buyer,"/marketplace?q="+encodeURIComponent(business));
      await buyer.getByRole("link",{name:/View business/}).click();
      await buyer.getByRole("button",{name:"Start acquisition"}).click();
      await buyer.waitForURL(/\/deals\/[^/]+$/,{timeout:20000});
      const deals=await api(buyer,"/deals");
      deal=deals.find(item=>item.listing.name===business);
      assert.ok(deal);
      await buyer.getByRole("button",{name:"Review and sign sample NDA"}).click();
      await buyer.getByRole("checkbox").click();
      await buyer.getByRole("button",{name:"Confirm",exact:true}).click();
      await visit(buyer,"/deals/"+deal.id+"/documents");
      await buyer.getByRole("button",{name:/Open/}).first().click();
      const protectedLink=buyer.getByRole("link",{name:"Open protected file"});
      const href=await protectedLink.getAttribute("href");
      const sample=await buyer.context().request.get(origin+href);
      assert.equal(sample.status(),200);
      assert.match(await sample.text(),/Fabricated DealOS browser/);
      await visit(buyer,"/deals/"+deal.id);
      await buyer.getByLabel("Your offer in Naira").fill("1900000");
      await buyer.getByRole("button",{name:"Submit offer"}).click();
      await buyer.getByText("Offer status").waitFor();
    });
    await t.test("advisor diligence, seller answer and offer acceptance",async()=>{
      await visit(advisor,"/deals/"+deal.id+"/diligence");
      await advisor.getByRole("button",{name:"Refresh diligence review"}).click();
      await advisor.getByText("Customer concentration above threshold").waitFor();
      await visit(seller,"/deals/"+deal.id+"/diligence");
      await seller.getByLabel("Your response").fill("Fabricated renewal terms: annual renewal and ninety days notice.");
      await seller.getByRole("button",{name:"Send response"}).click();
      await seller.getByText("annual renewal").waitFor();
      await visit(seller,"/deals/"+deal.id);
      await seller.getByRole("button",{name:"Accept offer"}).click();
      await seller.getByRole("button",{name:"Confirm decision"}).click();
      await seller.getByText("Accepted").first().waitFor();
    });
    await t.test("advisor closing, browser funding, both-party asset handover and release",async()=>{
      await stage(advisor,deal.id,"full diligence");
      await stage(advisor,deal.id,"spa");
      await visit(advisor,"/deals/"+deal.id);
      await advisor.getByRole("button",{name:"Create escrow"}).first().click();
      await advisor.getByRole("button",{name:"Create escrow"}).last().click();
      await advisor.getByRole("button",{name:"Move to escrow"}).waitFor();
      await stage(advisor,deal.id,"escrow");
      await visit(buyer,"/wallet");
      await buyer.getByRole("button",{name:"Add simulated funds"}).click();
      await buyer.getByLabel("Amount in Naira").fill("1900000");
      await buyer.getByRole("button",{name:"Credit demo balance"}).click();
      await buyer.getByText(/1,900,000/).first().waitFor();
      await escrowAction(buyer,deal.id,"Fund with demo balance");
      await stage(advisor,deal.id,"asset transfer");
      await confirmAssets(buyer,deal.id);
      await confirmAssets(seller,deal.id);
      await escrowAction(buyer,deal.id,"Confirm buyer completion");
      await escrowAction(seller,deal.id,"Confirm seller completion");
      await escrowAction(advisor,deal.id,"Confirm release conditions");
      await escrowAction(advisor,deal.id,"Release demo escrow");
      assert.equal((await api(advisor,"/deals/"+deal.id)).stage,"COMPLETED");
      const wallet=await api(seller,"/wallet");
      assert.equal(wallet.balanceMinor,"190000000");
      assert.equal(wallet.transactions.filter(x=>x.type==="ESCROW_RELEASE"&&x.dealId===deal.id).length,1);
    });
    await t.test("mobile marketplace and workspace remain navigable",async()=>{
      const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
      t.after(async()=>mobile.close());
      const screen=await mobile.newPage();
      await visit(screen,"/marketplace");
      assert.ok(await screen.getByRole("button",{name:"Search"}).isVisible());
      assert.ok(await screen.getByRole("link",{name:/View business/}).first().isVisible());
      const overflow=await screen.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
      assert.ok(overflow<=2,"Mobile marketplace overflows viewport by "+overflow+"px");
      await visit(screen,"/register");
      assert.ok(await screen.getByRole("button",{name:"Create account"}).isVisible());
      const authOverflow=await screen.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
      assert.ok(authOverflow<=2,"Mobile signup overflows viewport by "+authOverflow+"px");
    });
  }catch(error){
    for(const [name,page] of [["seller",seller],["buyer",buyer],["advisor",advisor]]){
      try{
        const path=join(root,"browser-"+name+"-failure.png");
        await page.screenshot({path,fullPage:true,timeout:2000});
        console.error(name+" screenshot: "+path+" at "+page.url());
      }catch{}
    }
    console.error("API tail: "+apiProcess.logs.join("").slice(-3000));
    console.error("Web tail: "+webProcess.logs.join("").slice(-3000));
    throw error;
  }
});
