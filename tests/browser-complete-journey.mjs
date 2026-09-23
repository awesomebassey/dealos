import assert from "node:assert/strict";
import {mkdtemp,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

const suffix=Date.now().toString(36);
const sample=Buffer.from("%PDF-1.4\n% Fabricated DealOS evidence only\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");

async function selectFile(page,selector,index,file){
  await page.activate();
  await page.cdp.send("DOM.enable");
  const {root}=await page.cdp.send("DOM.getDocument",{depth:1});
  const {nodeIds}=await page.cdp.send("DOM.querySelectorAll",{nodeId:root.nodeId,selector});
  assert.ok(nodeIds[index],"File input unavailable: "+selector+" "+index);
  await page.cdp.send("DOM.setFileInputFiles",{files:[file],nodeId:nodeIds[index]});
}
async function apiUntil(page,path,condition,until,label){
  return until(async()=>{
    const response=await page.fetch(path);
    return response.status===200 && condition(response.body) ? response.body : null;
  },label,20000);
}
async function selectOption(page,formIndex,label,until){
  await page.click(".select-trigger",formIndex);
  const index=await until(()=>page.eval("(()=>{const visible=[...document.querySelectorAll('[role=option]')].filter(el=>el.getBoundingClientRect().width>0);return visible.findIndex(el=>el.textContent.trim()==="+JSON.stringify(label)+")})()").then(i=>i>=0?i+1:null),"document type "+label);
  await page.click('[role=option]',index-1);
}
async function inspect(reviewer,path){
  const status=await reviewer.eval("(async()=>{const response=await fetch("+JSON.stringify("/api"+path)+",{credentials:'include'});return response.status})()");
  assert.equal(status,200,"Advisor must open sample before approving: "+path);
}
async function approveIdentity(advisor,userId,evidenceId,until){
  await advisor.goto("/reviews/"+userId);
  assert.ok(await advisor.textIncludes("Identity documents"));
  await inspect(advisor,"/kyc/evidence/"+evidenceId+"/sample");
  await advisor.button("Approve demo evidence");
  await advisor.button("Confirm demo review");
  await apiUntil(advisor,"/kyc/"+userId,r=>r.identityVerified,until,"identity approval");
}
async function approveListing(advisor,slug,category,until){
  await advisor.goto("/reviews/businesses/"+slug);
  const record=await apiUntil(advisor,"/listing-verification/"+slug,r=>r.verification.evidence.some(e=>e.category===category&&e.status==="SUBMITTED"),until,"evidence review queue");
  for(const e of record.verification.evidence.filter(e=>e.category===category&&e.status==="SUBMITTED")){
    await inspect(advisor,"/listing-verification/"+slug+"/evidence/"+e.id+"/sample");
  }
  await advisor.button("Approve documents");
  await advisor.button("Confirm review");
  const flag=category==="BUSINESS"?"businessVerified":"revenueVerified";
  await apiUntil(advisor,"/listing-verification/"+slug,r=>r.verification[flag],until,"approval "+category);
}
async function postStage(advisor,dealId,label,stage,until){
  await advisor.goto("/deals/"+dealId);
  await advisor.button("Move to "+label);
  await advisor.button("Confirm");
  await apiUntil(advisor,"/deals/"+dealId,r=>r.stage===stage,until,"advisor transition "+stage);
}
async function escrowClick(page,dealId,label,until,condition){
  await page.goto("/deals/"+dealId+"/escrow");
  await page.button(label);
  await page.button("Confirm");
  await apiUntil(page,"/escrow/deals/"+dealId,condition,until,"escrow "+label);
}
async function handover(page,dealId,party,until){
  await page.goto("/deals/"+dealId+"/assets");
  for(let i=1;i<=5;i++){
    await page.button("Confirm my side");
    await apiUntil(page,"/deals/"+dealId,r=>r.assetItems.filter(item=>party==="BUYER"?item.buyerDone:item.sellerDone).length===i,
      until,"asset confirmation "+party+" "+i);
  }
}
async function register(page,name,email,role,password,until){
  await page.goto("/register?account="+role);
  await page.hydration("form button");
  await page.fill("#register-name",name);
  await page.fill("#register-email",email);
  await page.fill("#register-password",password);
  await page.click('[role="checkbox"]');
  await page.button("Create account");
  await until(()=>page.eval("location.pathname==='/dashboard'"),role+" registration",20000);
  const me=await page.fetch("/auth/me");
  assert.equal(me.status,200);
  assert.equal(me.body.role,role);
  return me.body.id;
}
async function uploadPersonal(page,file,until){
  await page.goto("/kyc/identity");
  await page.hydration("form button");
  await selectFile(page,'input[type="file"]',0,file);
  await page.button("Submit for review");
  return apiUntil(page,"/kyc/me",r=>r.evidence.some(e=>e.status==="SUBMITTED"),until,"identity upload");
}
async function listingSample(seller,slug,section,index,label,file,until){
  await seller.goto("/my-listings/"+slug+"/verification");
  const before=(await seller.fetch("/listing-verification/"+slug)).body.verification.evidence.filter(e=>e.category===section).length;
  if(label)await selectOption(seller,index,label,until);
  await selectFile(seller,'input[type="file"]',index,file);
  await seller.button("Submit for review",index);
  await apiUntil(seller,"/listing-verification/"+slug,r=>r.verification.evidence.filter(e=>e.category===section).length===before+1,
    until,section+" sample upload");
}
export async function runCompleteJourney({browser,debuggerOrigin,newPage,until,password}){
  const temp=await mkdtemp(join(tmpdir(),"dealos-synthetic-"));
  const file=join(temp,"fabricated-evidence.pdf");
  await writeFile(file,sample);
  const seller=await newPage(browser,debuggerOrigin);
  const buyer=await newPage(browser,debuggerOrigin);
  const reviewer=await newPage(browser,debuggerOrigin);
  const sellerEmail="browser-seller-"+suffix+"@example.test";
  const buyerEmail="browser-buyer-"+suffix+"@example.test";
  const name="Browser Verified Business "+suffix;
  let step="registration";
  try{
    const sellerId=await register(seller,"Browser Seller",sellerEmail,"SELLER",password,until);
    const buyerId=await register(buyer,"Browser Buyer",buyerEmail,"BUYER",password,until);
    await reviewer.goto("/login");
    await reviewer.hydration("form button");
    await reviewer.fill("#login-email","nia@dealos.example");
    await reviewer.fill("#login-password",password);
    await reviewer.button("Sign in");
    await until(()=>reviewer.eval("location.pathname==='/dashboard'"),"advisor login",20000);
    step="identity uploads and advisor approvals";
    const sellerCase=await uploadPersonal(seller,file,until);
    const buyerCase=await uploadPersonal(buyer,file,until);
    await reviewer.goto("/reviews");
    assert.ok(await reviewer.textIncludes(sellerEmail),"Seller not visible in advisor review queue");
    assert.ok(await reviewer.textIncludes(buyerEmail),"Buyer not visible in advisor review queue");
    await approveIdentity(reviewer,sellerId,sellerCase.evidence.find(e=>e.status==="SUBMITTED").id,until);
    await approveIdentity(reviewer,buyerId,buyerCase.evidence.find(e=>e.status==="SUBMITTED").id,until);
    step="listing draft and business-specific evidence";
    await seller.goto("/my-listings/new");
    await seller.hydration("form button");
    await seller.fill("#listing-name",name);
    await seller.fill("#askingPriceNaira","2000000");
    await seller.fill("#annualRevenueNaira","1000000");
    await seller.fill("#recurringRevenuePct","75");
    await seller.fill("#customerConcentration","45");
    await seller.fill("#revenueTrendPct","7");
    await seller.fill("#ownerHoursPerWeek","15");
    await seller.click('[role="checkbox"]');
    await seller.button("Create business draft");
    await until(()=>seller.eval("location.pathname.startsWith('/my-listings/') && location.pathname.split('/').length===3"),"seller listing creation",20000);
    const slug=(await seller.eval("location.pathname")).split("/")[2];
    const listing=(await seller.fetch("/listings/mine")).body.find(l=>l.slug===slug);
    assert.equal(listing.name,name);
    await listingSample(seller,slug,"BUSINESS",0,null,file,until);
    await listingSample(seller,slug,"BUSINESS",0,"Business ownership",file,until);
    await listingSample(seller,slug,"BUSINESS",0,"Business address",file,until);
    await listingSample(seller,slug,"REVENUE",1,null,file,until);
    await listingSample(seller,slug,"REVENUE",1,"Profit and loss",file,until);
    step="advisor business and revenue decisions";
    await approveListing(reviewer,slug,"BUSINESS",until);
    await approveListing(reviewer,slug,"REVENUE",until);
    step="confidential documents and publication";
    await seller.goto("/my-listings/"+slug);
    await selectFile(seller,'input[type="file"]',0,file);
    await seller.button("Add document");
    await apiUntil(seller,"/data-room/listings/"+listing.id+"/documents",docs=>docs.some(d=>d.category==="Financial"),until,"confidential financial sample");
    await seller.goto("/my-listings/"+slug);
    await seller.button("Publish business");
    await apiUntil(seller,"/listings/mine",all=>all.some(l=>l.slug===slug&&l.status==="PUBLISHED"),until,"seller publication");
    step="buyer marketplace, NDA, private documents and offer";
    await buyer.goto("/marketplace?q="+encodeURIComponent(name));
    assert.ok(await buyer.textIncludes(name));
    await buyer.goto("/marketplace/"+slug);
    await buyer.button("Start acquisition");
    await until(()=>buyer.eval("location.pathname.startsWith('/deals/') && location.pathname.split('/').length===3"),"buyer acquisition",20000);
    const dealId=(await buyer.eval("location.pathname")).split("/")[2];
    await buyer.button("Review and sign sample NDA");
    await buyer.click('[role="checkbox"]');
    await buyer.button("Confirm");
    await apiUntil(buyer,"/deals/"+dealId,r=>r.stage==="DILIGENCE",until,"buyer NDA");
    await buyer.goto("/deals/"+dealId+"/documents");
    assert.ok(await buyer.textIncludes("fabricated-evidence.pdf"),"NDA-controlled financial file not visible");
    await buyer.button("Open");
    assert.ok(await buyer.textIncludes("Document access granted"));
    await buyer.goto("/deals/"+dealId);
    await buyer.fill("#offer-amount","1900000");
    await buyer.button("Submit offer");
    await apiUntil(buyer,"/deals/"+dealId,r=>r.offer?.status==="SUBMITTED",until,"submitted buyer offer");
    step="advisor diligence and seller response";
    await reviewer.goto("/deals/"+dealId+"/diligence");
    await reviewer.button("Refresh diligence review");
    const diligence=await apiUntil(reviewer,"/diligence/deals/"+dealId,r=>r.findings.some(f=>f.code==="CUSTOMER_CONCENTRATION"),until,"advisor diligence");
    assert.ok(diligence.questions.length>0);
    await seller.goto("/deals/"+dealId+"/diligence");
    await seller.fill("textarea[id^='answer-']","Synthetic customer contract renews annually with a ninety-day notice.");
    await seller.button("Send response");
    await apiUntil(seller,"/diligence/deals/"+dealId,r=>r.questions.some(q=>q.answer?.includes("renews annually")),until,"seller diligence response");
    step="offer acceptance and closing";
    await seller.goto("/deals/"+dealId);
    await seller.button("Accept offer");
    await seller.button("Confirm decision");
    await apiUntil(seller,"/deals/"+dealId,r=>r.offer?.status==="ACCEPTED"&&r.stage==="LOI",until,"seller offer acceptance");
    await postStage(reviewer,dealId,"full diligence","FULL_DILIGENCE",until);
    await postStage(reviewer,dealId,"spa","SPA",until);
    await reviewer.goto("/deals/"+dealId);
    await reviewer.button("Create escrow",0);
    await reviewer.button("Create escrow",1);
    await apiUntil(reviewer,"/deals/"+dealId,r=>r.escrow?.status==="CREATED",until,"explicit advisor escrow creation");
    await postStage(reviewer,dealId,"escrow","ESCROW",until);
    step="demo wallet and escrow funding";
    await buyer.goto("/wallet");
    await buyer.button("Add simulated funds");
    await buyer.fill("#demo-amount","1900000");
    await buyer.button("Credit demo balance");
    await apiUntil(buyer,"/wallet",w=>w.balanceMinor==="190000000",until,"buyer top-up");
    await escrowClick(buyer,dealId,"Fund with demo balance",until,e=>e.status==="FUNDED");
    step="dual-party asset transfer and simulated release";
    await postStage(reviewer,dealId,"asset transfer","ASSET_TRANSFER",until);
    await handover(buyer,dealId,"BUYER",until);
    await handover(seller,dealId,"SELLER",until);
    await escrowClick(buyer,dealId,"Confirm buyer completion",until,e=>!!e.buyerSignedOffAt);
    await escrowClick(seller,dealId,"Confirm seller completion",until,e=>!!e.sellerSignedOffAt);
    await escrowClick(reviewer,dealId,"Confirm release conditions",until,e=>!!e.platformConfirmedAt);
    await escrowClick(reviewer,dealId,"Release demo escrow",until,e=>e.status==="RELEASED");
    assert.equal((await buyer.fetch("/deals/"+dealId)).body.stage,"COMPLETED");
    const wallet=(await seller.fetch("/wallet")).body;
    assert.equal(wallet.balanceMinor,"190000000");
    assert.equal(wallet.transactions.filter(x=>x.dealId===dealId&&x.type==="ESCROW_RELEASE").length,1);
    console.log("PASS: real Chromium registration, verification, listing, offer, diligence, transfer and simulated Naira settlement");
  }catch(error){
    for(const [role,page] of [["buyer",buyer],["seller",seller],["advisor",reviewer]]){
      const diagnostics=await page.diagnostic().catch(e=>({error:e.message}));
      console.error("Complete browser journey "+step+" / "+role+": "+JSON.stringify(diagnostics).slice(0,1500));
    }
    throw error;
  }finally{
    seller.cdp.close();buyer.cdp.close();reviewer.cdp.close();
    await rm(temp,{recursive:true,force:true}).catch(()=>undefined);
  }
}
