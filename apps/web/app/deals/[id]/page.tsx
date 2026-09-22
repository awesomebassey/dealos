import Link from "next/link";
import { api,currentUser,money,sentence } from "../../../lib/api";
import { Pipeline } from "../../../components/pipeline";
import { DealActions } from "../../../components/deal-actions";
import { OfferActions } from "../../../components/offer-actions";
type Offer={id:string;status:string;amountMinor:string;message?:string|null};
type Audit={id:string;action:string;metadata?:{summary?:string};actor?:{name:string}|null;createdAt:string};
type Deal={id:string;ref:string;stage:string;version:number;agreedPriceMinor:string|null;
 listing:{name:string;category:string;askingPriceMinor:string;annualRevenueMinor:string};
 offer:Offer|null;escrow?:{status:string}|null;findings:Array<{id:string;title:string;detail:string;severity:string}>;
 auditEvents:Audit[]};
export default async function DealPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const [user,deal]=await Promise.all([currentUser(),api<Deal>(`/deals/${id}`)]);
 return <>
  <div className="page-head"><div><h1>{deal.listing.name}</h1><p>{deal.ref} / {deal.listing.category}</p></div>
    <DealActions dealId={id} stage={deal.stage} version={deal.version} userRole={user.role}/></div>
  <section className="card"><div className="section-head"><h2 className="section-title">Acquisition progress</h2><span className="status active">{sentence(deal.stage)}</span></div>
    <Pipeline stage={deal.stage}/></section>
  <div className="grid stats" style={{marginTop:16}}>
    <div className="card card-pad"><div className="stat-label">Business asking price</div><div className="stat-value">{money(deal.listing.askingPriceMinor)}</div></div>
    <div className="card card-pad"><div className="stat-label">Agreed amount</div><div className="stat-value">{money(deal.agreedPriceMinor)}</div></div>
    <div className="card card-pad"><div className="stat-label">Annual revenue</div><div className="stat-value">{money(deal.listing.annualRevenueMinor)}</div></div>
    <div className="card card-pad"><div className="stat-label">Simulated escrow</div><div className="stat-value" style={{fontSize:20}}>{deal.escrow?sentence(deal.escrow.status):"Awaiting offer"}</div></div>
  </div>
  <div className="grid two" style={{marginTop:18}}>
    <section className="card card-pad"><h2 className="section-title">Next steps</h2>
      <div className="list" style={{marginTop:12}}>
        {[
          [`/deals/${id}/documents`,"Review confidential documents"],
          [`/deals/${id}/diligence`,"Review due diligence"],
          [`/deals/${id}/escrow`,"View simulated escrow"],
          [`/deals/${id}/assets`,"Confirm asset transfer"],
        ].map(([href,label])=><div className="list-row" key={href}><Link className="text-link" href={href}>{label}</Link></div>)}
      </div>
      {deal.offer&&<div style={{marginTop:20}}><h3 className="section-title">Offer status</h3>
        <div className="list-row"><span>{money(deal.offer.amountMinor)}</span><span className="status">{sentence(deal.offer.status)}</span></div></div>}
    </section>
    <section className="card card-pad"><h2 className="section-title">Recent activity</h2><div className="timeline" style={{marginTop:12}}>
      {deal.auditEvents.slice(0,8).map(a=><div className="timeline-item" key={a.id}><div className="timeline-dot"/><div><div className="timeline-title">{a.metadata?.summary||sentence(a.action)}</div>
        <div className="timeline-meta">{a.actor?.name||"System"} / {new Date(a.createdAt).toLocaleString("en-NG")}</div></div></div>)}</div>
    </section>
  </div>
  <div style={{marginTop:18}}><OfferActions dealId={id} role={user.role} stage={deal.stage} askingPriceNaira={Number(deal.listing.askingPriceMinor)/100} offer={deal.offer}/></div>
 </>;
}
