"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { clientApi } from "../lib/client-api";

export function SellerQuestionAnswer({dealId,questionId}:{
  dealId:string;questionId:string;
}) {
  const router=useRouter();
  const [answer,setAnswer]=useState("");
  const [busy,setBusy]=useState(false);
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);
    try{
      await clientApi("/diligence/deals/"+dealId+"/questions/"+questionId+"/answer",{
        method:"POST",body:JSON.stringify({answer}),
      });
      toast.success("Response shared with this acquisition");
      setAnswer("");router.refresh();
    }catch(error){toast.error(error instanceof Error?error.message:"Unable to save response");}
    finally{setBusy(false);}
  }
  return <form className="form" onSubmit={submit} style={{marginTop:12}}>
    <div className="field">
      <label htmlFor={"answer-"+questionId}>Your response</label>
      <textarea id={"answer-"+questionId} className="input" style={{minHeight:110,paddingTop:12}}
        maxLength={2000} minLength={3} required value={answer}
        onChange={event=>setAnswer(event.target.value)}
        placeholder="Provide the supporting information the buyer requested"/>
    </div>
    <button className="button" disabled={busy}>{busy?"Saving":"Send response"}</button>
  </form>;
}
