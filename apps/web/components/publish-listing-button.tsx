"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { clientApi } from "../lib/client-api";
export function PublishListingButton({slug}:{slug:string}){
  const router=useRouter();const [busy,setBusy]=useState(false);
  async function publish(){
    setBusy(true);
    try{await clientApi(`/listings/${slug}/publish`,{method:"POST"});toast.success("Business is now published");router.refresh();}
    catch(e){toast.error(e instanceof Error?e.message:"Unable to publish listing");}
    finally{setBusy(false);}
  }
  return <button type="button" className="button" onClick={publish} disabled={busy}>{busy?"Publishing":"Publish business"}</button>;
}
