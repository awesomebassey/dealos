import Link from "next/link";
import { BadgeCheck, Building2, Fingerprint, ArrowRight } from "lucide-react";
import { api,currentUser,sentence } from "../../lib/api";
import { redirect } from "next/navigation";
type Evidence={id:string;category:string;documentType:string;status:string;reviewNote?:string|null};
type Kyc={status:string;identityVerified:boolean;businessVerified:boolean;revenueVerified:boolean;evidence:Evidence[]};
export default async function Verification(){
 const user=await currentUser();if(user.role!=="BUYER"&&user.role!=="SELLER")redirect("/dashboard");
 const data=await api<Kyc>("/kyc/me");
 const cards=[
  {category:"identity",label:"Personal verification",description:"Submit one synthetic NIN, BVN, driver licence or voter card sample.",done:data.identityVerified,Icon:Fingerprint},
  ...(user.role==="SELLER"?[
    {category:"business",label:"Business verification",description:"Submit fabricated CAC registration, ownership and address evidence.",done:data.businessVerified,Icon:Building2},
    {category:"revenue",label:"Revenue evidence",description:"Submit illustrative bank-statement and profit/loss samples.",done:data.revenueVerified,Icon:BadgeCheck},
  ]:[]),
 ];
 return <>
  <div className="page-head"><div><h1>Account verification</h1><p>Follow each card to submit samples and track the review of your account.</p></div>
    <span className="status">{data.status==="VERIFIED"?"Demo approved":sentence(data.status)}</span></div>
  <div className="warning-panel" style={{marginBottom:24}}>This is a simulated verification workflow. Never upload actual identity documents or financial information to the demonstration.</div>
  <div className="grid three">{cards.map(({category,label,description,done,Icon})=>
    <Link href={`/kyc/${category}`} className="card card-pad" key={category} style={{display:"block"}}>
      <div className="feature-icon"><Icon size={22}/></div>
      <h2 className="section-title" style={{marginTop:20}}>{label}</h2><p className="muted" style={{lineHeight:1.6}}>{description}</p>
      <div className="list-row"><span className={`status ${done?"success":"warning"}`}>{done?"Demo approved":data.evidence.some(e=>e.category===category.toUpperCase()&&e.status==="SUBMITTED")?"Awaiting sample review":"Not submitted"}</span><ArrowRight size={17}/></div>
    </Link>)}</div>
 </>;
}
