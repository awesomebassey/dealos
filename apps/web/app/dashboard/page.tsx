import Link from "next/link";
import { ArrowRight, BadgeCheck, Handshake, Landmark, SearchCheck, Store } from "lucide-react";
import { api, currentUser, type Deal, money, sentence } from "../../lib/api";

type MyListing={id:string;slug:string;name:string;status:string;askingPriceMinor:string;verification?:{businessVerified:boolean;revenueVerified:boolean}|null};
type Verification={identityVerified:boolean;businessVerified:boolean;revenueVerified:boolean;status:string};

export default async function Dashboard() {
  const user=await currentUser();
  const [deals,listings,verification]=await Promise.all([
    api<Deal[]>("/deals"),
    user.role==="SELLER"?api<MyListing[]>("/listings/mine"):Promise.resolve([]),
    user.role==="SELLER"||user.role==="BUYER"?api<Verification>("/kyc/me"):Promise.resolve(null),
  ]);
  const active=deals.filter(d=>!["WITHDRAWN","COMPLETED"].includes(d.stage));
  const priority=active.flatMap(d=>d.findings||[]).filter(f=>["HIGH","CRITICAL"].includes(f.severity)).length;
  const funded=active.filter(d=>["FUNDED","VERIFICATION","RELEASE_PENDING"].includes(d.escrow?.status||"")).length;
  const totalValue=active.reduce((sum,d)=>sum+BigInt(d.agreedPriceMinor||"0"),0n);
  const sellerReady=!!verification?.identityVerified;
  const buyerReady=!!verification?.identityVerified;
  const needsVerification=(user.role==="SELLER"&&!sellerReady)||(user.role==="BUYER"&&!buyerReady);
  const greeting=`Welcome back, ${user.name.split(" ")[0]}`;
  const action=user.role==="SELLER"
    ?(needsVerification?{href:"/kyc",label:"Continue verification"}:listings.length?{href:"/my-listings",label:"Manage my businesses"}:{href:"/my-listings/new",label:"List a business"})
    :user.role==="BUYER"
      ?(needsVerification?{href:"/kyc",label:"Continue verification"}:{href:"/marketplace",label:"Browse marketplace"})
      :{href:"/reviews",label:"Open review queue"};

  return <>
    <div className="page-head">
      <div><h1>{user.role==="ADVISOR"||user.role==="ADMIN"?"Acquisition workspace":greeting}</h1>
        <p>{user.role==="SELLER"?"Manage your business listings, buyer offers and handover responsibilities."
          :user.role==="BUYER"?"Track the businesses you are evaluating and the actions needed to complete an acquisition."
          :"Review account submissions and help assigned acquisitions progress through closing."}</p>
      </div>
      <Link className="button" href={action.href}>{action.label} <ArrowRight size={15}/></Link>
    </div>
    {needsVerification&&<section className="card card-pad" style={{marginBottom:20}}>
      <h2 className="section-title">Complete your personal verification</h2>
      <p className="muted">Your account needs an approved identity review before acquiring or publishing businesses.</p>
      <Link className="button secondary" href="/kyc/identity">Continue verification</Link>
    </section>}
    <div className="grid stats">
      <div className="card card-pad"><div className="kpi"><span className="kpi-icon"><Handshake size={19}/></span>
        <div><div className="stat-label">Active acquisitions</div><div className="stat-value">{active.length}</div></div></div>
        <div className="stat-foot">Deals still moving through their acquisition journeys</div></div>
      {user.role==="SELLER"?<div className="card card-pad"><div className="kpi"><span className="kpi-icon"><Store size={19}/></span>
        <div><div className="stat-label">Business listings</div><div className="stat-value">{listings.length}</div></div></div>
        <div className="stat-foot">{listings.filter(l=>l.status==="PUBLISHED").length} open to buyers</div></div>:
      <div className="card card-pad"><div className="kpi"><span className="kpi-icon"><SearchCheck size={19}/></span>
        <div><div className="stat-label">Priority findings</div><div className="stat-value">{priority}</div></div></div>
        <div className="stat-foot">High-priority findings across active deals</div></div>}
      <div className="card card-pad"><div className="kpi"><span className="kpi-icon"><Landmark size={19}/></span>
        <div><div className="stat-label">Funded demo escrows</div><div className="stat-value">{funded}</div></div></div>
        <div className="stat-foot">Illustrative funding awaiting transfer or release</div></div>
      <div className="card card-pad"><div className="kpi"><span className="kpi-icon"><BadgeCheck size={19}/></span>
        <div><div className="stat-label">Active agreed value</div><div className="stat-value" style={{fontSize:25}}>{money(totalValue)}</div></div></div>
        <div className="stat-foot">Combined value of your active transactions</div></div>
    </div>
    <section className="card" style={{marginTop:20}}>
      <div className="section-head"><h2 className="section-title">Your acquisitions</h2><Link className="text-link" href="/deals">View all</Link></div>
      {deals.length?<div className="table-wrap"><table>
        <thead><tr><th>Business</th><th>Stage</th><th>Agreed amount</th><th>Open findings</th><th></th></tr></thead>
        <tbody>{deals.slice(0,12).map(deal=><tr key={deal.id}>
          <td><strong>{deal.listing.name}</strong><div className="stat-foot">{deal.ref}</div></td>
          <td>{sentence(deal.stage)}</td><td>{money(deal.agreedPriceMinor)}</td><td>{deal.findings?.length||0}</td>
          <td><Link href={`/deals/${deal.id}`} className="text-link">Open deal</Link></td>
        </tr>)}</tbody></table></div>:
      <div className="empty"><h3>{user.role==="SELLER"?"Buyer conversations will appear here.":user.role==="BUYER"?"Find your first acquisition.":"No assigned deals yet."}</h3>
        <p>{user.role==="SELLER"?"Prepare and publish a business to start receiving buyer interest.":user.role==="BUYER"?"Browse the marketplace and start an acquisition after completing verification.":"Your assigned transactions will appear here."}</p>
        <Link href={action.href} className="button">{action.label}</Link></div>}
    </section>
  </>;
}
