"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const API_URL=process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function DealLiveUpdates({dealId}:{dealId:string}) {
  const router=useRouter();
  useEffect(()=>{
    const since=new Date(Date.now()-3_000).toISOString();
    const source=new EventSource(
      API_URL+"/api/deals/"+encodeURIComponent(dealId)+"/events?since="+encodeURIComponent(since),
      {withCredentials:true},
    );
    source.onmessage=()=>router.refresh();
    return ()=>source.close();
  },[dealId,router]);
  return null;
}
