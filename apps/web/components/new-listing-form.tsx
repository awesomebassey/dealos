"use client";

import * as Select from "@radix-ui/react-select";
import * as Checkbox from "@radix-ui/react-checkbox";
import { Check, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { clientApi } from "../lib/client-api";

const categories=["SaaS","E-commerce","Logistics","Health technology","Education technology","Fintech","Media","Analytics"];
const fields=[
  ["askingPriceNaira","Asking price in Naira"],
  ["annualRevenueNaira","Annual revenue in Naira"],
  ["recurringRevenuePct","Recurring revenue percent"],
  ["customerConcentration","Largest customer revenue percent"],
  ["revenueTrendPct","Revenue growth percent"],
  ["ownerHoursPerWeek","Owner hours per week"],
] as const;
export function NewListingForm(){
  const router=useRouter();
  const [category,setCategory]=useState(categories[0]);
  const [ipAssigned,setIpAssigned]=useState(false);
  const [litigationOpen,setLitigationOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);
    try{
      const body:Record<string,unknown>={name:String(data.get("name")||""),category,ipAssigned,litigationOpen};
      for(const [key] of fields) body[key]=Number(data.get(key));
      const listing=await clientApi<{slug:string}>("/listings",{method:"POST",body:JSON.stringify(body)});
      toast.success("Draft business listing created");
      router.push(`/my-listings/${listing.slug}`);
      router.refresh();
    }catch(e){toast.error(e instanceof Error?e.message:"Unable to create listing");}
    finally{setBusy(false);}
  }
  return <form className="form card card-pad" onSubmit={submit} style={{maxWidth:790}}>
    <div className="field"><label htmlFor="listing-name">Business name</label><input className="input" id="listing-name" name="name" required minLength={3} placeholder="Your registered business"/></div>
    <div className="field"><label>Business sector</label>
      <Select.Root value={category} onValueChange={setCategory}>
        <Select.Trigger className="select-trigger"><Select.Value/><Select.Icon><ChevronDown size={15}/></Select.Icon></Select.Trigger>
        <Select.Portal><Select.Content className="select-content" position="popper"><Select.Viewport>{categories.map(c=>
          <Select.Item key={c} value={c} className="select-item"><Select.ItemText>{c}</Select.ItemText><Select.ItemIndicator className="select-indicator"><Check size={14}/></Select.ItemIndicator></Select.Item>)}</Select.Viewport></Select.Content></Select.Portal>
      </Select.Root>
    </div>
    <div className="grid two">
      {fields.map(([key,label])=><div className="field" key={key}><label htmlFor={key}>{label}</label>
        <input className="input" id={key} name={key} type="number" required step={1} min={key==="revenueTrendPct"?-100:0} max={key==="revenueTrendPct"?500:key.endsWith("Pct")||key==="customerConcentration"?100:undefined} defaultValue={0}/></div>)}
    </div>
    <label className="checkbox-row"><Checkbox.Root className="checkbox-control" checked={ipAssigned} onCheckedChange={v=>setIpAssigned(v===true)}><Checkbox.Indicator><Check size={13}/></Checkbox.Indicator></Checkbox.Root>All product intellectual property belongs to this business.</label>
    <label className="checkbox-row"><Checkbox.Root className="checkbox-control" checked={litigationOpen} onCheckedChange={v=>setLitigationOpen(v===true)}><Checkbox.Indicator><Check size={13}/></Checkbox.Indicator></Checkbox.Root>There is ongoing litigation relevant to this business.</label>
    <p className="muted" style={{fontSize:13}}>The listing begins as a draft. Complete your simulated verification and add sample documents before publishing.</p>
    <button className="button" type="submit" disabled={busy}>{busy?"Saving":"Create business draft"}</button>
  </form>;
}
