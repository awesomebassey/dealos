import { api,currentUser } from "../../../../lib/api";
import { DiligenceActions } from "../../../../components/diligence-actions";
import { Severity } from "../../../../components/severity";
type Deal={id:string;listing:{name:string}};
type Result={findings:Array<{id:string;title:string;detail:string;severity:string}>;
  questions:Array<{id:string;question:string;answer?:string|null}>};
export default async function DealDiligence({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const [user,deal,result]=await Promise.all([currentUser(),api<Deal>(`/deals/${id}`),api<Result>(`/diligence/deals/${id}`)]);
 return <>
  <div className="page-head"><div><h1>Due diligence</h1><p>Review material risks and seller questions for {deal.listing.name}.</p></div>
    {["ADVISOR","ADMIN"].includes(user.role)&&<DiligenceActions dealId={id}/>}</div>
  <div className="grid two">
    <section className="card card-pad"><h2 className="section-title">Risk findings</h2>
      {result.findings.length?result.findings.map(f=><div className="finding" key={f.id}><div className="finding-title"><span>{f.title}</span><Severity value={f.severity}/></div><p>{f.detail}</p></div>):
      <div className="empty"><p>No findings yet. The deal advisor can run a structured review.</p></div>}
    </section>
    <section className="card card-pad"><h2 className="section-title">Questions for the seller</h2>
      {result.questions.length?result.questions.map((q,i)=><div className="list-row" key={q.id} style={{alignItems:"flex-start"}}>
      <strong style={{color:"var(--green)"}}>{i+1}</strong><div style={{flex:1}}>{q.question}</div></div>):
      <div className="empty"><p>Questions generated during diligence will appear here.</p></div>}
    </section>
  </div>
 </>;
}
