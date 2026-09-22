import { BadgeCheck, Building2, CircleCheck, Fingerprint } from "lucide-react";
import { api } from "../../lib/api";
import { roleFrom } from "../../lib/actors";

type Kyc={status:string;identityVerified:boolean;businessVerified:boolean;revenueVerified:boolean;riskScore:number;country:string;reviewedAt?:string|null;user?:{name:string;email:string;role:string}};

export default async function Kyc({searchParams}:{searchParams:Promise<{role?:string}>}){
  const {role:raw}=await searchParams; const role=roleFrom(raw); const data=role==="advisor"?await api<Kyc>("/kyc/10000000-0000-0000-0000-000000000002",role):await api<Kyc>("/kyc/me",role);
  const checks=[["Identity",data.identityVerified,Fingerprint],["Business registration",data.businessVerified,Building2],["Revenue evidence",data.revenueVerified,BadgeCheck]] as const;
  return <><div className="page-head"><div><h1>Verification</h1><p>{data.user?.name ?? "Account verification"} · {data.country}</p></div><span className="badge"><CircleCheck size={13}/>{data.status.toLowerCase().replaceAll("_"," ")}</span></div>
    <div className="grid stats"><div className="card card-pad"><div className="stat-label">Verification state</div><div className="stat-value" style={{fontSize:22}}>{data.status.toLowerCase().replaceAll("_"," ")}</div></div><div className="card card-pad"><div className="stat-label">Risk score</div><div className="stat-value">{data.riskScore}</div><div className="stat-foot">Lower is better</div></div><div className="card card-pad"><div className="stat-label">Country</div><div className="stat-value" style={{fontSize:22}}>{data.country}</div></div><div className="card card-pad"><div className="stat-label">Reviewed</div><div className="stat-value" style={{fontSize:20}}>{data.reviewedAt?new Date(data.reviewedAt).toLocaleDateString():"Pending"}</div></div></div>
    <section className="card card-pad" style={{marginTop:18}}><h2 className="section-title">Verification checks</h2><div className="grid three" style={{marginTop:16}}>{checks.map(([label,done,Icon])=><div className="finding" key={label}><div style={{display:"flex",alignItems:"center",gap:11}}><div className="kpi-icon"><Icon size={18}/></div><div><strong>{label}</strong><div className="stat-foot">{done?"Verified":"Pending review"}</div></div></div></div>)}</div></section>
  </>;
}
