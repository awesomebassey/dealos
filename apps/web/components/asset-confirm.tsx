"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { clientApi } from "../lib/client-api";
export function AssetConfirm({dealId,itemId,role,done}:{dealId:string;itemId:string;role:string;done:boolean}){
 const router=useRouter();const [busy,setBusy]=useState(false);
 if(!["BUYER","SELLER"].includes(role)||done)return null;
 async function confirm(){setBusy(true);try{
 await clientApi(`/deals/${dealId}/assets/${itemId}/confirm`,{method:"POST"});
 toast.success("Asset transfer confirmed for your side");router.refresh();}
 catch(e){toast.error(e instanceof Error?e.message:"Unable to confirm transfer");}finally{setBusy(false);}}
 return <button className="button secondary" disabled={busy} onClick={confirm}>{busy?"Updating":"Confirm my side"}</button>;
}
