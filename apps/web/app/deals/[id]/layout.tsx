import Link from "next/link";
import { api, type Deal,sentence } from "../../../lib/api";
import { DealLiveUpdates } from "../../../components/deal-live-updates";
const links=[["","Overview"],["documents","Documents"],["diligence","Due diligence"],["escrow","Escrow"],["assets","Asset transfer"]];
export default async function DealWorkspace({children,params}:{children:React.ReactNode;params:Promise<{id:string}>}){
 const {id}=await params;const deal=await api<Deal>(`/deals/${id}`);
 return <>
  <DealLiveUpdates dealId={id}/>
  <div style={{marginBottom:22}}><Link className="text-link" href="/deals">My deals</Link>
    <p className="muted" style={{margin:"10px 0 0",fontSize:12}}>{deal.listing.name} / {sentence(deal.stage)}</p>
  </div>
  <nav className="deal-tabs" aria-label="Acquisition sections">
  {links.map(([path,label])=><Link key={path} href={`/deals/${id}${path?"/"+path:""}`}>{label}</Link>)}</nav>
  {children}
 </>;
}
