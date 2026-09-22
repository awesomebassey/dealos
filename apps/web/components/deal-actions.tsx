"use client";
import * as Dialog from "@radix-ui/react-dialog";
import * as Checkbox from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { clientApi } from "../lib/client-api";
const nextStage:Record<string,string>={LOI:"FULL_DILIGENCE",FULL_DILIGENCE:"SPA",SPA:"ESCROW",ESCROW:"ASSET_TRANSFER"};
const label=(stage:string)=>stage.replaceAll("_"," ").toLowerCase();
export function DealActions({dealId,stage,version,userRole}:{
 dealId:string;stage:string;version:number;userRole:string;
}){
 const router=useRouter(),[busy,setBusy]=useState(false),[open,setOpen]=useState(false),[agreed,setAgreed]=useState(false);
 const canSign=userRole==="BUYER"&&stage==="NDA_PENDING";
 const next=nextStage[stage];
 const canAdvance=["ADVISOR","ADMIN"].includes(userRole)&&!!next;
 async function confirm(){
  setBusy(true);
  try{
   if(canSign){if(!agreed)throw new Error("Confirm you have reviewed the sample NDA");
    await clientApi(`/deals/${dealId}/nda/sign`,{method:"POST"});}
   else await clientApi(`/deals/${dealId}/transition`,{method:"POST",body:JSON.stringify({to:next,expectedVersion:version})});
   toast.success(canSign?"Sample NDA recorded":"Transaction advanced");setOpen(false);router.refresh();
  }catch(e){toast.error(e instanceof Error?e.message:"Unable to continue");}finally{setBusy(false);}
 }
 if(!canSign&&!canAdvance)return null;
 return <Dialog.Root open={open} onOpenChange={setOpen}>
  <Dialog.Trigger asChild><button className="button">{canSign?"Review and sign sample NDA":`Move to ${label(next)}`}</button></Dialog.Trigger>
  <Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="dialog-content">
    <Dialog.Title asChild><h2>{canSign?"Confidentiality agreement":"Advance the transaction?"}</h2></Dialog.Title>
    {canSign?<><Dialog.Description>The buyer agrees to use documents for evaluating this acquisition, maintain confidentiality and not disclose confidential information outside the authorized deal participants. This is an illustrative demonstration agreement, not a substitute for legal advice or a signed legal document.</Dialog.Description>
      <label className="checkbox-row" style={{marginTop:18}}><Checkbox.Root className="checkbox-control" checked={agreed} onCheckedChange={v=>setAgreed(v===true)}><Checkbox.Indicator><Check size={13}/></Checkbox.Indicator></Checkbox.Root>I have reviewed the sample confidentiality terms.</label></>:
      <Dialog.Description>This moves the acquisition from {label(stage)} to {label(next)}. The system checks the transaction's prerequisites and records the change.</Dialog.Description>}
    <div className="dialog-actions"><Dialog.Close asChild><button className="button secondary">Cancel</button></Dialog.Close>
      <button className="button" disabled={busy||(canSign&&!agreed)} onClick={confirm}>{busy?"Updating":"Confirm"}</button></div>
  </Dialog.Content></Dialog.Portal>
 </Dialog.Root>;
}
