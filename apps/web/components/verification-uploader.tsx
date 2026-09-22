"use client";
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, FileUp } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { clientApi } from "../lib/client-api";

export const demoEvidenceTypes={
 IDENTITY:[["NIN_SLIP","NIN sample"],["BVN_CONFIRMATION","BVN confirmation sample"],["DRIVERS_LICENSE","Driver's licence sample"],["VOTERS_CARD","Voter card sample"]],
 BUSINESS:[["CAC_CERTIFICATE","CAC certificate sample"],["OWNERSHIP_PROOF","Ownership evidence sample"],["ADDRESS_EVIDENCE","Business address sample"]],
 REVENUE:[["BANK_STATEMENT","Bank statement sample"],["PROFIT_LOSS","Profit and loss sample"]],
} as const;
type Category=keyof typeof demoEvidenceTypes;
export function VerificationUploader({category}:{category:Category}){
 const choices:readonly (readonly [string,string])[]=demoEvidenceTypes[category];
 const router=useRouter(),ref=useRef<HTMLInputElement>(null);
 const [kind,setKind]=useState<string>(choices[0][0]);
 const [file,setFile]=useState<File|null>(null);
 const [busy,setBusy]=useState(false);
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(!file)return;
  if(file.size>4_000_000){toast.error("Use a sample file smaller than 4MB");return;}
  setBusy(true);
  try{
   const bytes=new Uint8Array(await file.arrayBuffer());
   let binary="";for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
   await clientApi("/kyc/evidence",{method:"POST",body:JSON.stringify({
    category,documentType:kind,fileName:file.name,contentType:file.type,dataBase64:btoa(binary),
   })});
   toast.success("Synthetic evidence submitted for demo review");
   setFile(null);if(ref.current)ref.current.value="";router.refresh();
  }catch(e){toast.error(e instanceof Error?e.message:"Submission failed");}
  finally{setBusy(false);}
 }
 return <form onSubmit={submit} className="card card-pad form">
  <h2 className="section-title">Submit sample evidence</h2>
  <div className="warning-panel"><strong>Demonstration only.</strong> Use fabricated sample files with no real NIN, BVN, ID number, bank records or customer information. Review does not perform a real identity check.</div>
  <div className="field"><label>Document type</label><Select.Root value={kind} onValueChange={setKind}>
    <Select.Trigger className="select-trigger"><Select.Value/><Select.Icon><ChevronDown size={16}/></Select.Icon></Select.Trigger>
    <Select.Portal><Select.Content className="select-content" position="popper"><Select.Viewport>{choices.map(([v,label])=>
      <Select.Item key={v} value={v} className="select-item"><Select.ItemText>{label}</Select.ItemText><Select.ItemIndicator className="select-indicator"><Check size={14}/></Select.ItemIndicator></Select.Item>)}</Select.Viewport></Select.Content></Select.Portal>
  </Select.Root></div>
  <input ref={ref} type="file" accept=".pdf,.png,.jpg,.jpeg" style={{display:"none"}} onChange={e=>setFile(e.target.files?.[0]||null)}/>
  <button type="button" className="upload-target" onClick={()=>ref.current?.click()}><FileUp size={26}/>{file?file.name:"Choose a synthetic PDF or image"}<span className="muted">PDF, PNG, JPEG. Maximum 4MB.</span></button>
  <button type="submit" className="button" disabled={!file||busy}>{busy?"Submitting":"Submit sample for review"}</button>
 </form>;
}
