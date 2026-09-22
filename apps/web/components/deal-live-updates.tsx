"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function DealLiveUpdates({dealId}:{dealId:string}) {
  const router=useRouter();
  useEffect(()=>{
    const since=new Date(Date.now()-3_000).toISOString();
    const source=new EventSource(
      "/api/deals/"+encodeURIComponent(dealId)+"/events?since="+encodeURIComponent(since),
    );
    source.onmessage=()=>router.refresh();
    return ()=>source.close();
  },[dealId,router]);
  return null;
}
