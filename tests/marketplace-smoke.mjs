import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import test from "node:test";

const BASE = "http://127.0.0.1:4000/api";
const apiDirectory = fileURLToPath(new URL("../apps/api/", import.meta.url));
const samplePdf = Buffer.from(
  "%PDF-1.4\n% Synthetic, fabricated verification test only\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n",
).toString("base64");
const sampleCsv = Buffer.from(
  "period,revenue\n2025-01,100000\n2025-02,110000\nSYNTHETIC TEST ONLY,0\n",
).toString("base64");

class Account {
  constructor() { this.cookies = new Map(); }

  async request(method, path, body, key) {
    const headers = { accept: "application/json" };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (key) headers["idempotency-key"] = key;
    if (this.cookies.size) {
      headers.cookie = [...this.cookies.entries()].map(([name,value])=>name+"="+value).join("; ");
      if (!["GET","HEAD"].includes(method) && this.cookies.has("dealos_csrf")) {
        headers["x-csrf-token"] = decodeURIComponent(this.cookies.get("dealos_csrf"));
      }
    }
    const response = await fetch(BASE+path,{
      method,headers,body:body===undefined?undefined:JSON.stringify(body),
      signal:AbortSignal.timeout(20_000),
    });
    for (const setCookie of response.headers.getSetCookie()) {
      const [pair] = setCookie.split(";");
      const separator = pair.indexOf("=");
      if (separator > 0) this.cookies.set(pair.slice(0,separator),pair.slice(separator+1));
    }
    const contentType=response.headers.get("content-type")||"";
    const data=contentType.includes("application/json")?await response.json():await response.text();
    return {status:response.status,data};
  }

  async ok(method,path,body,key) {
    const res=await this.request(method,path,body,key);
    assert.ok(res.status>=200&&res.status<300,
      method+" "+path+" returned "+res.status+": "+JSON.stringify(res.data));
    return res.data;
  }

  async blocked(method,path,expected,body,key) {
    const res=await this.request(method,path,body,key);
    assert.equal(res.status,expected,
      method+" "+path+" should return "+expected+" but returned "+res.status+
      ": "+JSON.stringify(res.data));
  }

  get(path){return this.ok("GET",path);}
  post(path,body,key){return this.ok("POST",path,body,key);}
}

async function ready(child,logs) {
  for (let i=0;i<75;i++) {
    if (child.exitCode !== null) throw new Error("API exited during startup:\n"+logs.join(""));
    try {
      const r=await fetch(BASE+"/health",{signal:AbortSignal.timeout(500)});
      if(r.ok)return;
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  throw new Error("API did not start:\n"+logs.join(""));
}

function evidence(category,documentType) {
  return {category,documentType,fileName:"synthetic-"+documentType.toLowerCase()+".pdf",
    contentType:"application/pdf",dataBase64:samplePdf};
}

test("100 business marketplace and complete isolated sandbox acquisition", {timeout:120_000}, async t=>{
  const logs=[];
  const child=spawn(process.execPath,["dist/main.js"],{
    cwd:apiDirectory,env:{...process.env,API_PORT:"4000",API_PUBLIC_BASE_URL:"http://127.0.0.1:4000"},
    stdio:["ignore","pipe","pipe"],
  });
  child.stdout.on("data",buf=>logs.push(buf.toString()));
  child.stderr.on("data",buf=>logs.push(buf.toString()));
  t.after(async()=>{
    child.kill("SIGTERM");
    await Promise.race([
      new Promise(resolve=>child.once("exit",resolve)),
      new Promise(resolve=>setTimeout(resolve,3000)),
    ]);
    if(child.exitCode===null)child.kill("SIGKILL");
  });
  await ready(child,logs);
  const publicClient=new Account();
  const advisor=new Account();
  const buyer=new Account();
  const seller=new Account();
  const competingBuyer=new Account();

  await t.test("Marketplace returns 100 distinct businesses in 12-per-page results",async()=>{
    const seen=new Set();
    const first=await publicClient.get("/listings?page=1");
    assert.equal(first.total,100);
    assert.equal(first.pageSize,12);
    assert.equal(first.items.length,12);
    for(let page=1;page<=first.pages;page++){
      const data=page===1?first:await publicClient.get("/listings?page="+page);
      assert.ok(data.items.length<=12);
      for(const item of data.items){
        assert.ok(!seen.has(item.slug),"duplicate marketplace listing "+item.slug);
        seen.add(item.slug);
      }
    }
    assert.equal(seen.size,100);
    const filtered=await publicClient.get("/listings?q=KoraMetrics");
    assert.equal(filtered.items.length,1);
    assert.equal(filtered.items[0].name,"KoraMetrics");
  });

  const unique=Date.now().toString(36)+"-"+Math.random().toString(36).slice(2);
  const buyerUser=(await buyer.post("/auth/register",{
    name:"Synthetic Test Buyer",email:"smoke-buyer-"+unique+"@example.test",
    password:"SmokeTestPassword2026!",role:"BUYER",
  })).user;
  const sellerUser=(await seller.post("/auth/register",{
    name:"Synthetic Test Seller",email:"smoke-seller-"+unique+"@example.test",
    password:"SmokeTestPassword2026!",role:"SELLER",
  })).user;
  await advisor.post("/auth/login",{email:"nia@dealos.example",password:"DealOS2026!"});
  await competingBuyer.post("/auth/login",{email:"amara@northstar.capital",password:"DealOS2026!"});

  await t.test("Buyer and seller upload fabricated evidence and advisor completes all reviews",async()=>{
    await buyer.post("/kyc/evidence",evidence("IDENTITY","NIN_SLIP"));
    const sellerEvidence=[
      ["IDENTITY","DRIVERS_LICENSE"],
      ["BUSINESS","CAC_CERTIFICATE"],["BUSINESS","OWNERSHIP_PROOF"],["BUSINESS","ADDRESS_EVIDENCE"],
      ["REVENUE","BANK_STATEMENT"],["REVENUE","PROFIT_LOSS"],
    ];
    for(const [category,kind] of sellerEvidence)await seller.post("/kyc/evidence",evidence(category,kind));
    const sellerCase=await seller.get("/kyc/me");
    const sellerSampleId=sellerCase.evidence.find(item=>item.category==="IDENTITY")?.id;
    assert.ok(sellerSampleId,"seller identity sample must exist");
    await publicClient.blocked("GET","/kyc/evidence/"+sellerSampleId+"/sample",401);
    await buyer.blocked("GET","/kyc/evidence/"+sellerSampleId+"/sample",403);
    const advisorSample=await advisor.request("GET","/kyc/evidence/"+sellerSampleId+"/sample");
    assert.equal(advisorSample.status,200);
    assert.match(advisorSample.data,/Synthetic, fabricated verification test only/);
    const ownerSample=await seller.request("GET","/kyc/evidence/"+sellerSampleId+"/sample");
    assert.equal(ownerSample.status,200);
    const queue=await advisor.get("/kyc/review-queue");
    assert.ok(queue.some(item=>item.user.id===buyerUser.id));
    assert.ok(queue.some(item=>item.user.id===sellerUser.id));
    await advisor.blocked("POST","/kyc/"+buyerUser.id+"/review",400,{
      category:"IDENTITY",approve:true,note:"Cannot approve without inspecting synthetic evidence",
    });
    const buyerCase=await buyer.get("/kyc/me");
    for(const sample of [...buyerCase.evidence,...sellerCase.evidence]){
      const preview=await advisor.request("GET","/kyc/evidence/"+sample.id+"/sample");
      assert.equal(preview.status,200,"reviewer must be able to inspect "+sample.documentType);
      assert.match(preview.data,/Synthetic, fabricated verification test only/);
    }
    await advisor.post("/kyc/"+buyerUser.id+"/review",{category:"IDENTITY",approve:true,note:"Synthetic test accepted"});
    for(const category of ["IDENTITY","BUSINESS","REVENUE"]){
      await advisor.post("/kyc/"+sellerUser.id+"/review",{category,approve:true,note:"Synthetic test accepted"});
    }
    const buyerCheck=await buyer.get("/kyc/me");
    const sellerCheck=await seller.get("/kyc/me");
    assert.equal(buyerCheck.identityVerified,true);
    assert.equal(buyerCheck.status,"VERIFIED");
    assert.equal(sellerCheck.identityVerified,true);
    assert.equal(sellerCheck.businessVerified,true);
    assert.equal(sellerCheck.revenueVerified,true);
    assert.equal(sellerCheck.status,"VERIFIED");
  });

  let listing;
  let mainDeal;
  let competitorDeal;
  let financialDocId;
  await t.test("Verified seller creates a business with an isolated confidential room",async()=>{
    listing=await seller.post("/listings",{
      name:"Synthetic River Analytics "+unique,category:"Analytics",
      askingPriceNaira:2_000_000,annualRevenueNaira:1_000_000,
      recurringRevenuePct:80,customerConcentration:35,revenueTrendPct:12,
      ownerHoursPerWeek:20,ipAssigned:true,litigationOpen:false,
    });
    assert.equal(listing.status,"DRAFT");
    const upload=await seller.post("/data-room/documents",{
      listingId:listing.id,name:"Synthetic revenue.csv",category:"Financial",
      contentType:"text/csv",dataBase64:sampleCsv,
    });
    financialDocId=upload.id;
    const published=await seller.post("/listings/"+listing.slug+"/publish");
    assert.equal(published.status,"PUBLISHED");
    const found=await publicClient.get("/listings?q="+encodeURIComponent("Synthetic River Analytics "+unique));
    assert.equal(found.items.length,1);
  });

  await t.test("Two buyers join separately and NDA protects documents across deals",async()=>{
    mainDeal=await buyer.post("/listings/"+listing.slug+"/start-deal");
    const replay=await buyer.post("/listings/"+listing.slug+"/start-deal");
    assert.equal(replay.id,mainDeal.id);
    competitorDeal=await competingBuyer.post("/listings/"+listing.slug+"/start-deal");
    assert.notEqual(competitorDeal.id,mainDeal.id);
    await buyer.blocked("GET","/data-room/deals/"+mainDeal.id+"/documents",403);
    await buyer.post("/deals/"+mainDeal.id+"/nda/sign");
    await competingBuyer.post("/deals/"+competitorDeal.id+"/nda/sign");
    const mainDocs=await buyer.get("/data-room/deals/"+mainDeal.id+"/documents");
    assert.deepEqual(mainDocs.map(doc=>doc.id),[financialDocId]);
    const access=await buyer.post("/data-room/documents/"+financialDocId+"/access?dealId="+mainDeal.id);
    assert.ok(access.signedUrl.includes("/api/data-room/documents/"));
    const sameOriginPath=access.signedUrl.replace(/^\\/api/,"");
    const downloaded=await buyer.request("GET",sameOriginPath);
    assert.equal(downloaded.status,200);
    assert.match(downloaded.data,/SYNTHETIC TEST ONLY/);
    await publicClient.blocked("GET","/data-room/documents/"+financialDocId+
      "/download?dealId="+mainDeal.id,401);
    const differentDeal=await buyer.post("/listings/sample-business-001/start-deal");
    await buyer.post("/deals/"+differentDeal.id+"/nda/sign");
    const unrelated=await buyer.get("/data-room/deals/"+differentDeal.id+"/documents");
    assert.ok(unrelated.length>0);
    assert.ok(!unrelated.some(doc=>doc.id===financialDocId));
    await buyer.blocked("POST","/data-room/documents/"+financialDocId+
      "/access?dealId="+differentDeal.id,403);
  });

  await t.test("One seller acceptance withdraws the competing offer atomically",async()=>{
    await buyer.post("/offers/deals/"+mainDeal.id,{
      amountNaira:1_900_000,message:"Synthetic proposal subject to diligence",
    });
    await competingBuyer.post("/offers/deals/"+competitorDeal.id,{
      amountNaira:2_100_000,message:"Alternative synthetic proposal",
    });
    const accepted=await seller.post("/offers/deals/"+mainDeal.id+"/accept");
    assert.equal(accepted.status,"ACCEPTED");
    const declined=await competingBuyer.get("/deals/"+competitorDeal.id);
    assert.equal(declined.stage,"WITHDRAWN");
    assert.equal(declined.offer.status,"DECLINED");
    await competingBuyer.blocked("GET","/data-room/deals/"+competitorDeal.id+"/documents",403);
    const nowUnavailable=await publicClient.get("/listings?q="+encodeURIComponent("Synthetic River Analytics "+unique));
    assert.equal(nowUnavailable.total,0);
  });

  await t.test("Advisor advances closing only after accepted offer and seller verification",async()=>{
    let deal=await advisor.get("/deals/"+mainDeal.id);
    assert.equal(deal.stage,"LOI");
    for(const stage of ["FULL_DILIGENCE","SPA","ESCROW"]){
      deal=await advisor.post("/deals/"+mainDeal.id+"/transition",{
        to:stage,expectedVersion:deal.version,
      });
      assert.equal(deal.stage,stage);
      if(stage==="FULL_DILIGENCE"){
        await advisor.post("/diligence/deals/"+mainDeal.id+"/run");
        const findings=await advisor.get("/diligence/deals/"+mainDeal.id);
        assert.ok(Array.isArray(findings.findings));
        assert.ok(Array.isArray(findings.questions));
        assert.ok(findings.questions.length>0);
        const question=findings.questions[0];
        await seller.post("/diligence/deals/"+mainDeal.id+"/questions/"+question.id+"/answer",{
          answer:"Synthetic seller response supported by fabricated financial sample records",
        });
        const buyerView=await buyer.get("/diligence/deals/"+mainDeal.id);
        assert.equal(
          buyerView.questions.find(item=>item.id===question.id)?.answer,
          "Synthetic seller response supported by fabricated financial sample records",
        );
      }
    }
    const reviewed=await advisor.get("/deals/"+mainDeal.id);
    assert.equal(reviewed.stage,"ESCROW");
    const escrow=await advisor.get("/escrow/deals/"+mainDeal.id);
    assert.equal(escrow.status,"CREATED");
  });

  let topupKey="smoke-topup-"+unique;
  let fundKey="smoke-fund-"+unique;
  await t.test("Demo wallet funding and escrow are replay safe",async()=>{
    const [original,replay]=await Promise.all([
      buyer.post("/wallet/demo-topup",{amountNaira:1_900_000},topupKey),
      buyer.post("/wallet/demo-topup",{amountNaira:1_900_000},topupKey),
    ]);
    assert.equal(replay.id,original.id);
    const initialWallet=await buyer.get("/wallet");
    assert.equal(initialWallet.balanceMinor,String(190_000_000));
    const fund=await buyer.post("/escrow/deals/"+mainDeal.id+"/fund",{
      amountMinor:String(190_000_000),provider:"SANDBOX",
    },fundKey);
    const replayed=await buyer.post("/escrow/deals/"+mainDeal.id+"/fund",{
      amountMinor:String(190_000_000),provider:"SANDBOX",
    },fundKey);
    assert.equal(fund.id,replayed.id);
    const updated=await buyer.get("/wallet");
    assert.equal(updated.balanceMinor,"0");
    await competingBuyer.blocked("POST","/escrow/deals/"+mainDeal.id+"/fund",403,{
      amountMinor:String(190_000_000),provider:"SANDBOX",
    },"foreign-buyer-"+unique);
  });

  await t.test("Both parties confirm each asset, sign off, and advisor releases exactly once",async()=>{
    let deal=await advisor.get("/deals/"+mainDeal.id);
    deal=await advisor.post("/deals/"+mainDeal.id+"/transition",{
      to:"ASSET_TRANSFER",expectedVersion:deal.version,
    });
    assert.equal(deal.stage,"ASSET_TRANSFER");
    deal=await advisor.get("/deals/"+mainDeal.id);
    assert.ok(deal.assetItems?.length>0);
    for(const item of deal.assetItems){
      await buyer.post("/deals/"+mainDeal.id+"/assets/"+item.id+"/confirm");
      await seller.post("/deals/"+mainDeal.id+"/assets/"+item.id+"/confirm");
    }
    await buyer.post("/escrow/deals/"+mainDeal.id+"/sign-off",{party:"BUYER"});
    await seller.post("/escrow/deals/"+mainDeal.id+"/sign-off",{party:"SELLER"});
    const pending=await advisor.get("/escrow/deals/"+mainDeal.id);
    assert.equal(pending.status,"RELEASE_PENDING");
    assert.ok(pending.buyerSignedOffAt&&pending.sellerSignedOffAt);
    await advisor.post("/escrow/deals/"+mainDeal.id+"/platform-confirm");
    const releaseKey="smoke-release-"+unique;
    const [firstRelease,secondRelease]=await Promise.all([
      advisor.request("POST","/escrow/deals/"+mainDeal.id+"/release",undefined,releaseKey),
      advisor.request("POST","/escrow/deals/"+mainDeal.id+"/release",undefined,"parallel-release-"+unique),
    ]);
    const outcomes=[firstRelease,secondRelease];
    assert.equal(outcomes.filter(r=>r.status>=200&&r.status<300).length,1);
    assert.equal(outcomes.filter(r=>r.status===409).length,1);
    const successful=outcomes.find(r=>r.status>=200&&r.status<300);
    const winningKey=firstRelease===successful?releaseKey:"parallel-release-"+unique;
    const replayed=await advisor.post("/escrow/deals/"+mainDeal.id+"/release",undefined,winningKey);
    assert.equal(replayed.id,successful.data.id);
    await advisor.blocked("POST","/escrow/deals/"+mainDeal.id+"/release",409,undefined,
      "second-release-"+unique);
    await advisor.blocked("POST","/escrow/deals/"+mainDeal.id+"/platform-confirm",409);
    const finalDeal=await advisor.get("/deals/"+mainDeal.id);
    assert.equal(finalDeal.stage,"COMPLETED");
    const sellerWallet=await seller.get("/wallet");
    assert.equal(sellerWallet.balanceMinor,String(190_000_000));
    const transactions=sellerWallet.transactions.filter(item=>item.dealId===mainDeal.id);
    assert.equal(transactions.length,1);
  });
});
