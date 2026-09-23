"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { clientApi } from "../lib/client-api";
export function ReviewCategory({userId,category}:{userId:string;category:"IDENTITY"}){
 const router=useRouter();const [open,setOpen]=useState(false),[approve,setApprove]=useState(false),[note,setNote]=useState(""),[busy,setBusy]=useState(false);
 async function submit(){
  setBusy(true);
  try{await clientApi(`/kyc/${userId}/review`,{method:"POST",body:JSON.stringify({category,approve,note})});
    toast.success(approve?"Sample review approved":"Sample review returned");setOpen(false);router.refresh();}
  catch(e){toast.error(e instanceof Error?e.message:"Unable to review samples");}finally{setBusy(false);}
 }
 return <Dialog.Root open={open} onOpenChange={setOpen}>
  <div className="page-actions"><button type="button" className="button secondary" onClick={()=>{setApprove(false);setOpen(true);}}>Request correction</button>
    <button type="button" className="button" onClick={()=>{setApprove(true);setOpen(true);}}>Approve demo evidence</button></div>
  <Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="dialog-content">
    <Dialog.Title asChild><h2>{approve?"Approve sample evidence?":"Request corrected samples?"}</h2></Dialog.Title>
    <Dialog.Description>Record the result of reviewing the submitted identity sample.</Dialog.Description>
    <div className="field"><label htmlFor="review-note">Review note</label><textarea id="review-note" className="input" style={{height:100,paddingTop:12}} value={note} onChange={e=>setNote(e.target.value)} maxLength={500}/></div>
    <div className="dialog-actions"><Dialog.Close asChild><button className="button secondary">Cancel</button></Dialog.Close>
      <button className="button" onClick={submit} disabled={busy}>{busy?"Saving":"Confirm demo review"}</button></div>
  </Dialog.Content></Dialog.Portal>
 </Dialog.Root>;
}
