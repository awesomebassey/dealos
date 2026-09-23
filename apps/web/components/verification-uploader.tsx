"use client";
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, FileUp } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { clientApi } from "../lib/client-api";

export const evidenceTypes={
 IDENTITY:[["NIN_SLIP","NIN sample"],["BVN_CONFIRMATION","BVN confirmation sample"],["DRIVERS_LICENSE","Driver's licence sample"],["VOTERS_CARD","Voter card sample"]],
 BUSINESS:[["CAC_CERTIFICATE","CAC registration"],["OWNERSHIP_PROOF","Business ownership"],["ADDRESS_EVIDENCE","Business address"]],
 REVENUE:[["BANK_STATEMENT","Bank statement"],["PROFIT_LOSS","Profit and loss"]],
} as const;
type Category=keyof typeof evidenceTypes;

export function VerificationUploader({category,listingSlug}:{category:Category;listingSlug?:string}){
 const router=useRouter();
 const choices:readonly (readonly [string,string])[]=evidenceTypes[category];
 const ref=useRef<HTMLInputElement>(null);
 const [kind,setKind]=useState<string>(choices[0][0]);
 const [file,setFile]=useState<File|null>(null);
 const [busy,setBusy]=useState(false);
 const limit=listingSlug?2_000_000:4_000_000;

 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!file)return;
  if(file.size>limit){toast.error(`Choose a file smaller than ${Math.floor(limit/1_000_000)}MB`);return;}
  setBusy(true);
  try{
   const bytes=new Uint8Array(await file.arrayBuffer());
   let binary="";
   for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
   const endpoint=listingSlug?`/listing-verification/${listingSlug}/evidence`:"/kyc/evidence";
   await clientApi(endpoint,{method:"POST",body:JSON.stringify({
    category,documentType:kind,fileName:file.name,contentType:file.type,dataBase64:btoa(binary),
   })});
   toast.success("Document submitted for review");
   setFile(null);
   if(ref.current)ref.current.value="";
   router.refresh();
  }catch(e){toast.error(e instanceof Error?e.message:"Could not submit document");}
  finally{setBusy(false);}
 }
 return <form onSubmit={submit} className="card card-pad form">
  <h2 className="section-title">Submit documents</h2>
  <div className="field"><label>Document type</label>
   <Select.Root value={kind} onValueChange={setKind}>
    <Select.Trigger className="select-trigger"><Select.Value/><Select.Icon><ChevronDown size={16}/></Select.Icon></Select.Trigger>
    <Select.Portal><Select.Content className="select-content" position="popper"><Select.Viewport>
      {choices.map(([value,label])=><Select.Item key={value} value={value} className="select-item">
        <Select.ItemText>{label}</Select.ItemText><Select.ItemIndicator className="select-indicator"><Check size={14}/></Select.ItemIndicator>
      </Select.Item>)}
    </Select.Viewport></Select.Content></Select.Portal>
   </Select.Root>
  </div>
  <input ref={ref} type="file" accept=".pdf,.png,.jpg,.jpeg" className="sr-only" style={{display:"none"}}
    onChange={e=>setFile(e.target.files?.[0]||null)}/>
  <button type="button" className="upload-target" onClick={()=>ref.current?.click()}>
    <FileUp size={25}/>
    {file?file.name:"Choose a PDF or image"}
    <span className="muted">Sample files only, up to {Math.floor(limit/1_000_000)}MB</span>
  </button>
  <button type="submit" className="button" disabled={!file||busy}>{busy?"Submitting":"Submit for review"}</button>
 </form>;
}
