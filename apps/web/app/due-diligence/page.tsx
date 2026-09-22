import { api, type Deal } from "../../lib/api";
import { roleFrom } from "../../lib/actors";
import { DiligenceActions } from "../../components/diligence-actions";
import { Severity } from "../../components/severity";

type Data={findings:Array<{id:string;title:string;severity:string;detail:string;evidence:Record<string,unknown>}>;questions:Array<{id:string;question:string;answer?:string|null}>};

export default async function Diligence({ searchParams }:{searchParams:Promise<{role?:string}>}){
  const {role:raw}=await searchParams; const role=roleFrom(raw); const deals=await api<Deal[]>("/deals",role); const deal=deals[0];
  if(!deal) return <div className="empty">No active deal.</div>;
  const data=await api<Data>(`/diligence/deals/${deal.id}`,role);
  const critical=data.findings.filter(f=>["HIGH","CRITICAL"].includes(f.severity)).length;
  return <><div className="page-head"><div><h1>Due diligence</h1><p>{deal.listing.name} · structured risk review</p></div><DiligenceActions dealId={deal.id} role={role}/></div>
    <div className="grid stats"><div className="card card-pad"><div className="stat-label">Open findings</div><div className="stat-value">{data.findings.length}</div></div><div className="card card-pad"><div className="stat-label">High severity</div><div className="stat-value">{critical}</div></div><div className="card card-pad"><div className="stat-label">Questions</div><div className="stat-value">{data.questions.length}</div></div><div className="card card-pad"><div className="stat-label">Review status</div><div className="stat-value" style={{fontSize:21}}>In progress</div></div></div>
    <div className="grid two" style={{marginTop:18}}><section className="card card-pad"><h2 className="section-title">Risk findings</h2><div style={{marginTop:16}}>{data.findings.map(f=><div className="finding" key={f.id}><div className="finding-title"><span>{f.title}</span><Severity value={f.severity}/></div><p>{f.detail}</p></div>)}</div></section><section className="card card-pad"><h2 className="section-title">Questions for seller</h2><div className="list" style={{marginTop:12}}>{data.questions.map((q,i)=><div className="list-row" key={q.id} style={{alignItems:"flex-start"}}><span className="badge gold">{String(i+1).padStart(2,"0")}</span><div style={{lineHeight:1.55,fontSize:13,flex:1}}>{q.question}</div></div>)}</div></section></div>
  </>;
}
