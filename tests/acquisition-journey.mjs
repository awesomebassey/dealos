import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const base="http://127.0.0.1:4000/api";
const cwd=fileURLToPath(new URL("../apps/api/",import.meta.url));
const demoPassword=process.env.DEALOS_SMOKE_DEMO_PASSWORD;
if(!demoPassword)throw new Error("Set DEALOS_SMOKE_DEMO_PASSWORD for the local demo test");
const suffix=Date.now().toString(36);
const pdf=Buffer.from("%PDF-1.4\n% Fabricated test sample, no personal data\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n").toString("base64");
const csv=Buffer.from("month,revenue\nJanuary,8000\nFebruary,9000\n").toString("base64");

class Client {
  cookies=new Map();
  async request(method,path,body,key){
    const headers={accept:"application/json"};
    if(body!==undefined)headers["content-type"]="application/json";
    if(key)headers["idempotency-key"]=key;
    if(this.cookies.size){
      headers.cookie=[...this.cookies].map(([k,v])=>k+"="+v).join("; ");
      if(!["GET","HEAD"].includes(method))headers["x-csrf-token"]=decodeURIComponent(this.cookies.get("dealos_csrf")||"");
    }
    const response=await fetch(base+path,{method,headers,
      body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15_000)});
    for(const cookie of response.headers.getSetCookie()){
      const [pair]=cookie.split(";");const at=pair.indexOf("=");
      if(at>0)this.cookies.set(pair.slice(0,at),pair.slice(at+1));
    }
    const type=response.headers.get("content-type")||"";
    return {status:response.status,data:type.includes("application/json")?await response.json():await response.text()};
  }
  async ok(method,path,body,key){
    const r=await this.request(method,path,body,key);
    assert.ok(r.status>=200&&r.status<300,method+" "+path+" failed: "+JSON.stringify(r.data));
    return r.data;
  }
  get(path){return this.ok("GET",path);}
  post(path,body,key){return this.ok("POST",path,body,key);}
  async rejects(method,path,status,body,key){
    const r=await this.request(method,path,body,key);
    assert.equal(r.status,status,method+" "+path+" returned "+JSON.stringify(r.data));
  }
}
const sample=(category,documentType)=>({
  category,documentType,fileName:"illustrative-evidence.pdf",contentType:"application/pdf",dataBase64:pdf,
});
const listingPayload=name=>({
  name,category:"Analytics",askingPriceNaira:2_000_000,annualRevenueNaira:1_000_000,
  recurringRevenuePct:75,customerConcentration:45,revenueTrendPct:7,
  ownerHoursPerWeek:15,ipAssigned:true,litigationOpen:false,
});
async function ready(child,logs){
  for(let i=0;i<100;i++){
    if(child.exitCode!==null)throw new Error("API exited: "+logs.join(""));
    try{const r=await fetch(base+"/health",{signal:AbortSignal.timeout(600)});if(r.ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,180));
  }
  throw new Error("API not ready: "+logs.join(""));
}

test("full multi-business acquisition and settlement",{timeout:120_000},async t=>{
 const logs=[];
 const child=spawn(process.execPath,["dist/main.js"],{cwd,env:{...process.env,API_PORT:"4000"},stdio:["ignore","pipe","pipe"]});
 child.stdout.on("data",b=>logs.push(String(b)));
 child.stderr.on("data",b=>logs.push(String(b)));
 t.after(async()=>{
   child.kill("SIGTERM");
   await Promise.race([new Promise(resolve=>child.once("exit",resolve)),
     new Promise(resolve=>setTimeout(resolve,2000))]);
   if(child.exitCode===null)child.kill("SIGKILL");
 });
 await ready(child,logs);
 const anon=new Client(),advisor=new Client(),buyer=new Client(),seller=new Client(),other=new Client(),racer=new Client();
 await advisor.post("/auth/login",{email:"nia@dealos.example",password:demoPassword});
 await other.post("/auth/login",{email:"amara@northstar.capital",password:demoPassword});
 const [buyerUser,sellerUser,racerUser]=await Promise.all([
   buyer.post("/auth/register",{name:"Example Buyer",email:"new-buyer-"+suffix+"@example.test",password:demoPassword,role:"BUYER"}),
   seller.post("/auth/register",{name:"Example Seller",email:"new-seller-"+suffix+"@example.test",password:demoPassword,role:"SELLER"}),
   racer.post("/auth/register",{name:"Parallel Buyer",email:"new-racer-"+suffix+"@example.test",password:demoPassword,role:"BUYER"}),
 ]);
 await t.test("100 businesses paginate predictably without duplicate listings",async()=>{
   const pages=[];
   for(let page=1;page<=9;page++){
     const result=await anon.get("/listings?page="+page);
     assert.equal(result.total,100);
     assert.equal(result.page,page);
     assert.equal(result.pages,9);
     assert.equal(result.items.length,page===9?4:12);
     pages.push(...result.items);
   }
   assert.equal(pages.length,100);
   assert.equal(new Set(pages.map(listing=>listing.id)).size,100);
   const noResults=await anon.get("/listings?page=10");
   assert.equal(noResults.items.length,0);
   const filter=await anon.get("/listings?q=KoraMetrics");
   assert.equal(filter.total,1);
   assert.equal(filter.items[0].slug,"korametrics");
 });
 await t.test("registration requires account-level identity approval",async()=>{
   await buyer.post("/kyc/evidence",sample("IDENTITY","DRIVERS_LICENSE"));
   await seller.post("/kyc/evidence",sample("IDENTITY","DRIVERS_LICENSE"));
   await racer.post("/kyc/evidence",sample("IDENTITY","DRIVERS_LICENSE"));
   for(const client of [buyer,seller,racer]){
     const kyc=await client.get("/kyc/me");
     assert.equal(kyc.identityVerified,false);
     for(const file of kyc.evidence){
       const preview=await advisor.request("GET","/kyc/evidence/"+file.id+"/sample");
       assert.equal(preview.status,200);
       await other.rejects("GET","/kyc/evidence/"+file.id+"/sample",403);
     }
   }
   await advisor.post("/kyc/"+racerUser.user.id+"/review",{category:"IDENTITY",approve:true});
   await advisor.post("/kyc/"+buyerUser.user.id+"/review",{category:"IDENTITY",approve:true});
   await advisor.post("/kyc/"+sellerUser.user.id+"/review",{category:"IDENTITY",approve:true});
   const account=await seller.get("/kyc/me");
   assert.equal(account.identityVerified,true);
   assert.equal(account.businessVerified,false);
 });
 await t.test("concurrent acquisition retries return a single deal",async()=>{
   const [first,second]=await Promise.all([
     buyer.post("/listings/sample-business-002/start-deal"),
     buyer.post("/listings/sample-business-002/start-deal"),
   ]);
   assert.equal(first.id,second.id);
   assert.equal(first.listingId,second.listingId);
 });
 let listing,deal,competing;
 await t.test("each business requires an independent registration and revenue review",async()=>{
   listing=await seller.post("/listings",listingPayload("River Analytics "+suffix));
   const unrelated=await seller.post("/listings",listingPayload("Mountain Media "+suffix));
   assert.equal(listing.status,"DRAFT");
   await seller.rejects("POST","/listings/"+listing.slug+"/publish",403);
   const document=await seller.post("/data-room/documents",{
     listingId:listing.id,name:"Revenue sample",category:"Financial",contentType:"text/csv",dataBase64:csv,
   });
   assert.ok(document.id);
   const types=[
     ["BUSINESS","CAC_CERTIFICATE"],["BUSINESS","OWNERSHIP_PROOF"],
     ["BUSINESS","ADDRESS_EVIDENCE"],["REVENUE","BANK_STATEMENT"],["REVENUE","PROFIT_LOSS"],
   ];
   for(const [section,kind] of types){
     await seller.post("/listing-verification/"+listing.slug+"/evidence",sample(section,kind));
   }
   const caseFile=await seller.get("/listing-verification/"+listing.slug);
   assert.equal(caseFile.verification.businessVerified,false);
   const queue=await advisor.get("/listing-verification/review-queue");
   assert.ok(queue.some(c=>c.listing.slug===listing.slug));
   for(const file of caseFile.verification.evidence){
     const preview=await advisor.request("GET","/listing-verification/"+listing.slug+"/evidence/"+file.id+"/sample");
     assert.equal(preview.status,200);
   }
   await advisor.post("/listing-verification/"+listing.slug+"/review",{category:"BUSINESS",approve:true});
   await advisor.post("/listing-verification/"+listing.slug+"/review",{category:"REVENUE",approve:true});
   const approved=await seller.get("/listing-verification/"+listing.slug);
   assert.equal(approved.verification.businessVerified,true);
   assert.equal(approved.verification.revenueVerified,true);
   const independent=await seller.get("/listing-verification/"+unrelated.slug);
   assert.equal(independent.verification.businessVerified,false);
   assert.equal(independent.verification.revenueVerified,false);
   assert.equal((await seller.post("/listings/"+listing.slug+"/publish")).status,"PUBLISHED");
   await seller.rejects("POST","/listings/"+unrelated.slug+"/publish",403);
   await buyer.rejects("POST","/listing-verification/"+listing.slug+"/evidence",403,sample("BUSINESS","CAC_CERTIFICATE"));
   await seller.post("/listing-verification/"+listing.slug+"/evidence",sample("BUSINESS","CAC_CERTIFICATE"));
   assert.equal((await anon.get("/listings?q="+encodeURIComponent("River Analytics "+suffix))).total,0);
   await buyer.rejects("POST","/listings/"+listing.slug+"/start-deal",404);
   const pending=await seller.get("/listing-verification/"+listing.slug);
   const fresh=pending.verification.evidence.find(e=>e.category==="BUSINESS"&&e.status==="SUBMITTED");
   assert.ok(fresh);
   assert.equal((await advisor.request("GET","/listing-verification/"+listing.slug+"/evidence/"+fresh.id+"/sample")).status,200);
   await advisor.post("/listing-verification/"+listing.slug+"/review",{category:"BUSINESS",approve:true});
   assert.equal((await seller.post("/listings/"+listing.slug+"/publish")).status,"PUBLISHED");
   // Resubmitting the seller's personal identity must pause public listings too.
   await seller.post("/kyc/evidence",sample("IDENTITY","VOTERS_CARD"));
   assert.equal((await anon.get("/listings?q="+encodeURIComponent("River Analytics "+suffix))).total,0);
   const sellerIdentity=await seller.get("/kyc/me");
   const replacement=sellerIdentity.evidence.find(e=>e.status==="SUBMITTED");
   assert.ok(replacement);
   assert.equal((await advisor.request("GET","/kyc/evidence/"+replacement.id+"/sample")).status,200);
   await advisor.post("/kyc/"+sellerUser.user.id+"/review",{category:"IDENTITY",approve:true});
   assert.equal((await seller.post("/listings/"+listing.slug+"/publish")).status,"PUBLISHED");
   const search=await anon.get("/listings?q="+encodeURIComponent("River Analytics "+suffix));
   assert.equal(search.total,1);
 });
 await t.test("NDA prevents cross-deal document access",async()=>{
   deal=await buyer.post("/listings/"+listing.slug+"/start-deal");
   competing=await other.post("/listings/"+listing.slug+"/start-deal");
   assert.notEqual(deal.id,competing.id);
   assert.equal((await buyer.post("/listings/"+listing.slug+"/start-deal")).id,deal.id);
   await buyer.rejects("GET","/data-room/deals/"+deal.id+"/documents",403);
   await other.rejects("GET","/data-room/deals/"+deal.id+"/documents",403);
   const [firstSignature,replayedSignature]=await Promise.all([
     buyer.post("/deals/"+deal.id+"/nda/sign"),
     buyer.post("/deals/"+deal.id+"/nda/sign"),
   ]);
   assert.equal(firstSignature.id,replayedSignature.id,"Concurrent NDA submissions must reuse the same agreement");
   const signedDeal=await buyer.get("/deals/"+deal.id);
   assert.equal(signedDeal.version,1,"NDA must advance the deal once");
   assert.equal(signedDeal.auditEvents.filter(event=>event.action==="NDA_SIGNED").length,1,
     "Concurrent NDA requests must create only one signed event");
   await other.post("/deals/"+competing.id+"/nda/sign");
   const docs=await buyer.get("/data-room/deals/"+deal.id+"/documents");
   assert.equal(docs.length,1);
   const opened=await buyer.post("/data-room/documents/"+docs[0].id+"/access?dealId="+deal.id);
   const read=await buyer.request("GET",opened.signedUrl.slice(4));
   assert.equal(read.status,200);
   assert.match(read.data,/January/);
   const another=await buyer.post("/listings/sample-business-001/start-deal");
   await buyer.post("/deals/"+another.id+"/nda/sign");
   await buyer.rejects("POST","/data-room/documents/"+docs[0].id+"/access?dealId="+another.id,403);
 });
 await t.test("advisor diligence, seller responses and per-acquisition isolation",async()=>{
   const primary=await advisor.post("/diligence/deals/"+deal.id+"/run");
   assert.ok(primary.findings.some(f=>f.code==="CUSTOMER_CONCENTRATION"));
   const question=primary.questions.find(q=>q.question.includes("largest customer"));
   assert.ok(question);
   const customQuestion="Please share the illustrative monthly churn figures and any material customer contract renewals.";
   await seller.rejects("POST","/diligence/deals/"+deal.id+"/questions",403,{question:customQuestion});
   await other.rejects("POST","/diligence/deals/"+deal.id+"/questions",403,{question:customQuestion});
   await buyer.rejects("POST","/diligence/deals/"+competing.id+"/questions",403,{question:customQuestion});
   const asked=await buyer.post("/diligence/deals/"+deal.id+"/questions",{question:customQuestion});
   assert.equal(asked.question,customQuestion);
   assert.equal((await buyer.post("/diligence/deals/"+deal.id+"/questions",{question:customQuestion})).id,asked.id,
     "A duplicate click must not create another diligence question");
   await seller.post("/diligence/deals/"+deal.id+"/questions/"+asked.id+"/answer",{
     answer:"Illustrative monthly churn is under three percent. Customer renewals are annual.",
   });
   await buyer.rejects("POST","/diligence/deals/"+deal.id+"/questions/"+question.id+"/answer",403,{answer:"Unauthorized answer"});
   await seller.post("/diligence/deals/"+deal.id+"/questions/"+question.id+"/answer",{
     answer:"The illustrative largest customer renews annually, with a ninety-day notice period.",
   });
   const updated=await buyer.get("/diligence/deals/"+deal.id);
   assert.match(updated.questions.find(q=>q.id===question.id).answer,/renews annually/);
   assert.match(updated.questions.find(q=>q.id===asked.id).answer,/monthly churn/i);
   const competitor=await advisor.post("/diligence/deals/"+competing.id+"/run");
   assert.ok(competitor.questions.length>0);
   assert.ok(competitor.questions.every(q=>!q.answer),"Seller answers must stay with their acquisition");
   assert.ok(!competitor.questions.some(q=>q.question===customQuestion),"Buyer questions cannot leak to a competing acquisition");
   await buyer.rejects("GET","/diligence/deals/"+competing.id,403);
 });
 await t.test("offer and explicit advisor escrow creation",async()=>{
   await buyer.post("/offers/deals/"+deal.id,{amountNaira:1_900_000});
   await other.post("/offers/deals/"+competing.id,{amountNaira:1_850_000});
   await buyer.rejects("POST","/offers/deals/"+deal.id,409,{amountNaira:1_800_000});
   const [accepted,raced]=await Promise.all([
     seller.request("POST","/offers/deals/"+deal.id+"/accept"),
     racer.request("POST","/listings/"+listing.slug+"/start-deal"),
   ]);
   assert.ok(accepted.status>=200&&accepted.status<300,JSON.stringify(accepted.data));
   assert.equal(accepted.data.status,"ACCEPTED");
   assert.ok([201,404,409].includes(raced.status),JSON.stringify(raced));
   if(raced.status===201)assert.equal((await racer.get("/deals/"+raced.data.id)).stage,"WITHDRAWN");
   assert.equal((await other.get("/deals/"+competing.id)).stage,"WITHDRAWN");
   await seller.rejects("POST","/listing-verification/"+listing.slug+"/evidence",409,sample("REVENUE","BANK_STATEMENT"));
   let current=await advisor.get("/deals/"+deal.id);
   for(const stage of ["FULL_DILIGENCE","SPA"]){
     current=await advisor.post("/deals/"+deal.id+"/transition",{to:stage,expectedVersion:current.version});
   }
   await advisor.rejects("POST","/deals/"+deal.id+"/transition",409,{
     to:"ESCROW",expectedVersion:current.version,
   });
   const escrow=await advisor.post("/escrow/deals/"+deal.id+"/create");
   assert.equal(escrow.status,"CREATED");
   assert.equal((await advisor.post("/escrow/deals/"+deal.id+"/create")).id,escrow.id);
   await other.rejects("GET","/escrow/deals/"+deal.id,403);
   current=await advisor.post("/deals/"+deal.id+"/transition",{to:"ESCROW",expectedVersion:current.version});
   assert.equal(current.stage,"ESCROW");
 });
 await t.test("funding is replay safe and seller receives only one simulated payout",async()=>{
   const key="topup-"+suffix;
   const topup=await buyer.post("/wallet/demo-topup",{amountNaira:1_900_000},key);
   assert.equal((await buyer.post("/wallet/demo-topup",{amountNaira:1_900_000},key)).id,topup.id);
   assert.equal((await buyer.get("/wallet")).balanceMinor,"190000000");
   await buyer.rejects("POST","/wallet/demo-topup",409,{amountNaira:2000},key);
   const funding=await buyer.post("/escrow/deals/"+deal.id+"/fund",{
     amountMinor:"190000000",provider:"SANDBOX",
   },"fund-"+suffix);
   assert.equal((await buyer.post("/escrow/deals/"+deal.id+"/fund",{
     amountMinor:"190000000",provider:"SANDBOX",
   },"fund-"+suffix)).id,funding.id);
   assert.equal((await buyer.get("/wallet")).balanceMinor,"0");
   await other.rejects("POST","/escrow/deals/"+deal.id+"/fund",403,{
     amountMinor:"190000000",provider:"SANDBOX",
   },"foreign-"+suffix);
   await advisor.rejects("POST","/escrow/deals/"+deal.id+"/release",409,undefined,"premature-"+suffix);
   let stage=await advisor.get("/deals/"+deal.id);
   stage=await advisor.post("/deals/"+deal.id+"/transition",{to:"ASSET_TRANSFER",expectedVersion:stage.version});
   stage=await advisor.get("/deals/"+deal.id);
   assert.ok(stage.assetItems.length>0);
   for(const item of stage.assetItems){
     await buyer.post("/deals/"+deal.id+"/assets/"+item.id+"/confirm");
     await seller.post("/deals/"+deal.id+"/assets/"+item.id+"/confirm");
   }
   await buyer.post("/escrow/deals/"+deal.id+"/sign-off",{party:"BUYER"});
   await seller.post("/escrow/deals/"+deal.id+"/sign-off",{party:"SELLER"});
   await advisor.post("/escrow/deals/"+deal.id+"/platform-confirm");
   const first=await advisor.post("/escrow/deals/"+deal.id+"/release",undefined,"release-"+suffix);
   assert.equal((await advisor.post("/escrow/deals/"+deal.id+"/release",undefined,"release-"+suffix)).id,first.id);
   assert.equal((await advisor.get("/deals/"+deal.id)).stage,"COMPLETED");
   const wallet=await seller.get("/wallet");
   assert.equal(wallet.balanceMinor,"190000000");
   assert.equal(wallet.transactions.filter(t=>t.type==="ESCROW_RELEASE"&&t.dealId===deal.id).length,1);
   const ledger=await advisor.get("/escrow/deals/"+deal.id);
   const total=direction=>ledger.ledgerEntries.filter(l=>l.direction===direction)
     .reduce((sum,l)=>sum+BigInt(l.amountMinor),0n);
   assert.equal(total("DEBIT"),total("CREDIT"));
 });
});
