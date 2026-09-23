"use client";
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, FileUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { clientApi } from "../lib/client-api";
const categories=["Financial","Customers","Legal","Technical","Operations"];
export function SellerDocumentUpload({listingId}:{listingId:string}){
  const router=useRouter(),fileRef=useRef<HTMLInputElement>(null);
  const [file,setFile]=useState<File|null>(null);
  const [name,setName]=useState("");
  const [category,setCategory]=useState(categories[0]);
  const [busy,setBusy]=useState(false);
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(!file)return;
    if(file.size>4_000_000){toast.error("Sample files must be under 4MB");return;}
    setBusy(true);
    try{
      const bytes=new Uint8Array(await file.arrayBuffer());
      let binary="";for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
      const contentType=file.type|| (file.name.toLowerCase().endsWith(".csv")?"text/csv":"application/pdf");
      await clientApi("/data-room/documents",{method:"POST",body:JSON.stringify({
        listingId,name,category,contentType,dataBase64:btoa(binary),
      })});
      toast.success("Sample document added");setFile(null);setName("");router.refresh();
    }catch(e){toast.error(e instanceof Error?e.message:"Unable to upload sample");}
    finally{setBusy(false);}
  }
  return <form className="card card-pad form" onSubmit={submit}>
    <h2 className="section-title">Add a confidential sample document</h2>
    <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.csv" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0]||null;setFile(f);if(f)setName(f.name);}}/>
    <button className="upload-target" type="button" onClick={()=>fileRef.current?.click()}>
      <FileUp size={25}/>{file?file.name:"Choose a sample document"}<span className="muted">PDF, PNG, JPEG or CSV samples under 4MB</span>
    </button>
    <div className="field"><label htmlFor="doc-name">Document name</label><input id="doc-name" className="input" value={name} onChange={e=>setName(e.target.value)} minLength={2} required/></div>
    <div className="field"><label>Document category</label><Select.Root value={category} onValueChange={setCategory}>
      <Select.Trigger className="select-trigger"><Select.Value/><Select.Icon><ChevronDown size={15}/></Select.Icon></Select.Trigger>
      <Select.Portal><Select.Content className="select-content" position="popper"><Select.Viewport>{categories.map(c=><Select.Item className="select-item" key={c} value={c}><Select.ItemText>{c}</Select.ItemText><Select.ItemIndicator className="select-indicator"><Check size={14}/></Select.ItemIndicator></Select.Item>)}</Select.Viewport></Select.Content></Select.Portal>
    </Select.Root></div>
    <button className="button" disabled={!file||busy} type="submit">{busy?"Uploading":"Add document"}</button>
  </form>;
}
