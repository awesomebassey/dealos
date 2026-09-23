"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { clientApi } from "../lib/client-api";
type Offer={id:string;status:string;amountMinor:string;message?:string|null};
export function OfferActions({dealId,role,stage,askingPriceNaira,offer}:{
 dealId:string;role:string;stage:string;askingPriceNaira:number;offer?:Offer|null;
}){
 const router=useRouter();const [busy,setBusy]=useState(false),[amount,setAmount]=useState(String(askingPriceNaira)),[message,setMessage]=useState("");
 const [decision,setDecision]=useState<"accept"|"decline"|null>(null);
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);
  try{await clientApi(`/offers/deals/${dealId}`,{method:"POST",body:JSON.stringify({amountNaira:Number(amount),message})});
    toast.success("Offer submitted for seller review");router.refresh();}
  catch(e){toast.error(e instanceof Error?e.message:"Could not submit offer");}finally{setBusy(false);}
 }
 async function respond(){
  if(!decision)return;setBusy(true);
  try{await clientApi(`/offers/deals/${dealId}/${decision}`,{method:"POST"});
    toast.success(decision==="accept"?"Offer accepted. Closing can proceed.":"Offer declined.");setDecision(null);router.refresh();}
  catch(e){toast.error(e instanceof Error?e.message:"Could not review offer");}finally{setBusy(false);}
 }
 if(role==="BUYER"&&stage==="DILIGENCE"&&!offer)return <form className="card card-pad form" onSubmit={submit}>
  <h2 className="section-title">Make an offer</h2><p className="muted">After reviewing the documents and initial diligence, submit your proposed Naira amount.</p>
  <div className="field"><label htmlFor="offer-amount">Your offer in Naira</label><input id="offer-amount" className="input" type="number" min={10000} step={1000} value={amount} onChange={e=>setAmount(e.target.value)} required/></div>
  <div className="field"><label htmlFor="offer-note">Message to seller</label><textarea id="offer-note" className="input" style={{height:95,paddingTop:12}} value={message} onChange={e=>setMessage(e.target.value)} maxLength={2000}/></div>
  <button className="button" disabled={busy}>{busy?"Submitting":"Submit offer"}</button>
 </form>;
 if(role==="SELLER"&&offer?.status==="SUBMITTED")return <Dialog.Root open={decision!==null} onOpenChange={open=>!open&&setDecision(null)}>
  <div className="card card-pad">
    <h2 className="section-title">Buyer offer awaiting your decision</h2>
    <p className="muted" style={{margin:"12px 0"}}>{offer.message||"The buyer has submitted an acquisition proposal."}</p>
    <div className="page-actions"><button className="button secondary" onClick={()=>setDecision("decline")}>Decline offer</button>
      <button className="button" onClick={()=>setDecision("accept")}>Accept offer</button></div>
  </div>
  <Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="dialog-content">
    <Dialog.Title asChild><h2>{decision==="accept"?"Accept this acquisition offer?":"Decline this offer?"}</h2></Dialog.Title>
    <Dialog.Description>{decision==="accept"?"The listing will stop accepting offers, the agreed price will be recorded. An advisor will open escrow during closing.":"The buyer will be notified of the decision within DealOS."}</Dialog.Description>
    <div className="dialog-actions"><Dialog.Close asChild><button className="button secondary">Cancel</button></Dialog.Close>
      <button className="button" disabled={busy} onClick={respond}>{busy?"Saving":"Confirm decision"}</button></div>
  </Dialog.Content></Dialog.Portal>
 </Dialog.Root>;
 return null;
}
