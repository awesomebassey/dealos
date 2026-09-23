"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { clientApi } from "../lib/client-api";

export function BuyerQuestionForm({dealId}:{dealId:string}) {
  const router=useRouter();
  const [question,setQuestion]=useState("");
  const [busy,setBusy]=useState(false);

  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(busy)return;
    setBusy(true);
    try {
      await clientApi(`/diligence/deals/${dealId}/questions`,{
        method:"POST",body:JSON.stringify({question}),
      });
      toast.success("Question shared with this acquisition");
      setQuestion("");
      router.refresh();
    } catch(error) {
      toast.error(error instanceof Error?error.message:"Unable to submit question");
    } finally {
      setBusy(false);
    }
  }

  return <form className="form" onSubmit={submit} style={{margin:"18px 0 24px"}}>
    <div className="field">
      <label htmlFor="buyer-question">Ask the seller</label>
      <textarea id="buyer-question" className="input" style={{minHeight:104,paddingTop:12}}
        placeholder="Ask about this business's revenue, customers, operations or transition"
        minLength={10} maxLength={1000} required value={question}
        onChange={event=>setQuestion(event.target.value)}/>
    </div>
    <button className="button" disabled={busy||question.trim().length<10}>
      {busy?"Sending":"Ask seller"}
    </button>
  </form>;
}
