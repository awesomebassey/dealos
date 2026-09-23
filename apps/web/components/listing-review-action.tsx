"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { clientApi } from "../lib/client-api";

export function ListingReviewAction({slug,category}:{slug:string;category:"BUSINESS"|"REVENUE"}){
 const router=useRouter();
 const [open,setOpen]=useState(false);
 const [approve,setApprove]=useState(false);
 const [note,setNote]=useState("");
 const [busy,setBusy]=useState(false);
 async function submit(){
  setBusy(true);
  try{
    await clientApi(`/listing-verification/${slug}/review`,{
      method:"POST",body:JSON.stringify({category,approve,note}),
    });
    toast.success(approve?"Review approved":"Corrections requested");setOpen(false);router.refresh();
  }catch(e){toast.error(e instanceof Error?e.message:"Review could not be saved");}
  finally{setBusy(false);}
 }
 return <Dialog.Root open={open} onOpenChange={setOpen}>
  <div className="page-actions">
    <button type="button" className="button secondary" onClick={()=>{setApprove(false);setOpen(true);}}>Request changes</button>
    <button type="button" className="button" onClick={()=>{setApprove(true);setOpen(true);}}>Approve documents</button>
  </div>
  <Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="dialog-content">
    <Dialog.Title asChild><h2>{approve?"Approve this business section?":"Request new documents?"}</h2></Dialog.Title>
    <Dialog.Description>Review the documents for this specific business before recording your decision.</Dialog.Description>
    <div className="field">
      <label htmlFor="listing-review-note">Review note</label>
      <textarea id="listing-review-note" className="input" style={{height:95,paddingTop:12}} value={note}
        maxLength={500} onChange={e=>setNote(e.target.value)}/>
    </div>
    <div className="dialog-actions">
      <Dialog.Close asChild><button type="button" className="button secondary">Cancel</button></Dialog.Close>
      <button type="button" className="button" disabled={busy} onClick={submit}>{busy?"Saving":"Confirm review"}</button>
    </div>
  </Dialog.Content></Dialog.Portal>
 </Dialog.Root>;
}
