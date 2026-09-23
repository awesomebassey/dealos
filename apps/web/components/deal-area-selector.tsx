import Link from "next/link";
import { api, type Deal,money,sentence } from "../lib/api";
export async function DealAreaSelector({area,title,description}:{area:"documents"|"diligence"|"escrow";title:string;description:string}){
 const deals=await api<Deal[]>("/deals");
 return <>
  <div className="page-head"><div><h1>{title}</h1><p>{description}</p></div></div>
  {deals.length?<div className="grid three">
    {deals.map(deal=><Link className="card card-pad" href={`/deals/${deal.id}/${area}`} key={deal.id}>
      <h2 className="section-title">{deal.listing.name}</h2>
      <p className="muted">{deal.listing.category}</p>
      <div className="list-row"><span className="muted">Acquisition stage</span><strong>{sentence(deal.stage)}</strong></div>
      <div className="list-row"><span className="muted">Transaction value</span><strong>{money(deal.agreedPriceMinor)}</strong></div>
      <span className="text-link" style={{display:"block",marginTop:14}}>Open {title.toLowerCase()}</span>
    </Link>)}
  </div>:<div className="card empty"><h3>No acquisitions yet</h3><p>Choose a business in the marketplace to begin an acquisition.</p>
    <Link href="/marketplace" className="button">Explore marketplace</Link></div>}
 </>;
}
