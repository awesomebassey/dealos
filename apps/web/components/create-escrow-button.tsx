"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { clientApi } from "../lib/client-api";
export function CreateEscrowButton({dealId}:{dealId:string}){
 const router=useRouter();
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);
 async function create(){
  setBusy(true);
  try{await clientApi(`/escrow/deals/${dealId}/create`,{method:"POST"});
    toast.success("Escrow account opened for this acquisition");
    setOpen(false);router.refresh();
  }catch(e){toast.error(e instanceof Error?e.message:"Unable to open escrow");}
  finally{setBusy(false);}
 }
 return <Dialog.Root open={open} onOpenChange={setOpen}>
  <Dialog.Trigger asChild><button type="button" className="button">Create escrow</button></Dialog.Trigger>
  <Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="dialog-content">
    <Dialog.Title asChild><h2>Open escrow for this acquisition?</h2></Dialog.Title>
    <Dialog.Description>This creates a separate Naira escrow account for the accepted offer. The buyer can fund it after the closing agreement is approved.</Dialog.Description>
    <div className="dialog-actions"><Dialog.Close asChild><button className="button secondary">Cancel</button></Dialog.Close>
      <button className="button" disabled={busy} onClick={create}>{busy?"Creating":"Create escrow"}</button>
    </div>
  </Dialog.Content></Dialog.Portal>
 </Dialog.Root>;
}
