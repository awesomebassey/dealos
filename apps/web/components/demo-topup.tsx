"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useRef,useState } from "react";
import { toast } from "sonner";
import { clientApi } from "../lib/client-api";
export function DemoTopup(){
 const router=useRouter();const [open,setOpen]=useState(false),[amount,setAmount]=useState(""),[busy,setBusy]=useState(false);
 const key=useRef<string>(crypto.randomUUID());
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();const naira=Number(amount);
  if(!Number.isInteger(naira)||naira<1000){toast.error("Enter at least ₦1,000");return;}
  setBusy(true);
  try{
   await clientApi("/wallet/demo-topup",{method:"POST",headers:{"idempotency-key":key.current},body:JSON.stringify({amountNaira:naira})});
   toast.success("Demo balance updated. No money was transferred.");
   setOpen(false);setAmount("");key.current=crypto.randomUUID();router.refresh();
  }catch(e){toast.error(e instanceof Error?e.message:"Unable to update demo balance");}
  finally{setBusy(false);}
 }
 return <Dialog.Root open={open} onOpenChange={setOpen}>
  <Dialog.Trigger asChild><button className="button">Add funds</button></Dialog.Trigger>
  <Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="dialog-content">
    <Dialog.Title asChild><h2>Add to your demo balance</h2></Dialog.Title>
    <Dialog.Description>Choose an illustrative amount in Naira. No bank account, payment provider or actual money is used.</Dialog.Description>
    <form className="form" onSubmit={submit}>
      <div className="field"><label htmlFor="demo-amount">Amount in Naira</label><input id="demo-amount" className="input" type="number" min={1000} step={1000} max={10000000000} required value={amount} onChange={e=>{setAmount(e.target.value);key.current=crypto.randomUUID();}}/></div>
      <div className="dialog-actions"><Dialog.Close asChild><button className="button secondary" type="button">Cancel</button></Dialog.Close><button className="button" disabled={busy} type="submit">{busy?"Updating":"Credit demo balance"}</button></div>
    </form>
  </Dialog.Content></Dialog.Portal>
 </Dialog.Root>;
}
