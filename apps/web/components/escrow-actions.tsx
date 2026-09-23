"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useRef,useState } from "react";
import { toast } from "sonner";
import { clientApi } from "../lib/client-api";
import { money } from "../lib/money-client";
type Action={label:string;title:string;description:string;path:string;body?:unknown;idempotent?:boolean};
export function EscrowActions({dealId,dealStage,userRole,status,amountMinor,buyerSigned,sellerSigned,platformConfirmed,assetsComplete}:{
 dealId:string;dealStage:string;userRole:string;status:string;amountMinor:string;
 buyerSigned:boolean;sellerSigned:boolean;platformConfirmed:boolean;assetsComplete:boolean;
}){
 const router=useRouter(),key=useRef<string>(crypto.randomUUID());
 const [busy,setBusy]=useState(false),[action,setAction]=useState<Action|null>(null);
 let available:Action|null=null;
 if(userRole==="BUYER"&&dealStage==="ESCROW"&&status==="CREATED"){
  available={label:"Fund with demo balance",title:"Fund simulated escrow?",description:`Move ${money(amountMinor)} from your wallet into this acquisition's simulated escrow. No actual money is transferred.`,path:`/escrow/deals/${dealId}/fund`,body:{amountMinor,provider:"SANDBOX"},idempotent:true};
 }else if(userRole==="BUYER"&&dealStage==="ASSET_TRANSFER"&&assetsComplete&&["FUNDED","VERIFICATION","RELEASE_PENDING"].includes(status)&&!buyerSigned){
  available={label:"Confirm buyer completion",title:"Confirm your handover checks?",description:"Every asset has been confirmed. Your sign-off contributes to the simulated release decision.",path:`/escrow/deals/${dealId}/sign-off`,body:{party:"BUYER"}};
 }else if(userRole==="SELLER"&&dealStage==="ASSET_TRANSFER"&&assetsComplete&&["FUNDED","VERIFICATION","RELEASE_PENDING"].includes(status)&&!sellerSigned){
  available={label:"Confirm seller completion",title:"Confirm asset handover?",description:"Your confirmation is required before simulated escrow release.",path:`/escrow/deals/${dealId}/sign-off`,body:{party:"SELLER"}};
 }else if(["ADVISOR","ADMIN"].includes(userRole)&&buyerSigned&&sellerSigned&&!platformConfirmed){
  available={label:"Confirm release conditions",title:"Approve simulated release?",description:"Both parties confirmed the transfer. Record the advisor's simulated release approval.",path:`/escrow/deals/${dealId}/platform-confirm`};
 }else if(["ADVISOR","ADMIN"].includes(userRole)&&status==="RELEASE_PENDING"&&platformConfirmed){
  available={label:"Release demo escrow",title:"Complete simulated settlement?",description:`Credit the seller's wallet with ${money(amountMinor)}. No real payout takes place.`,path:`/escrow/deals/${dealId}/release`,idempotent:true};
 }
 async function run(){
  if(!action)return;setBusy(true);
  try{
   await clientApi(action.path,{method:"POST",headers:action.idempotent?{"idempotency-key":key.current}:{},
    body:action.body?JSON.stringify(action.body):undefined});
   key.current=crypto.randomUUID();toast.success("Simulated escrow updated");setAction(null);router.refresh();
  }catch(e){toast.error(e instanceof Error?e.message:"Unable to update simulated escrow");}finally{setBusy(false);}
 }
 if(!available)return null;
 return <Dialog.Root open={action!==null} onOpenChange={open=>!open&&setAction(null)}>
  <button className="button" onClick={()=>setAction(available)}>{available.label}</button>
  <Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="dialog-content">
    <Dialog.Title asChild><h2>{action?.title}</h2></Dialog.Title><Dialog.Description>{action?.description}</Dialog.Description>
    <div className="dialog-actions"><Dialog.Close asChild><button className="button secondary">Cancel</button></Dialog.Close>
      <button className="button" disabled={busy} onClick={run}>{busy?"Processing":"Confirm"}</button></div>
  </Dialog.Content></Dialog.Portal>
 </Dialog.Root>;
}
