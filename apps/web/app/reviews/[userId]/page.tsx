import Link from "next/link";
import { api,currentUser,sentence } from "../../../lib/api";
import { redirect } from "next/navigation";
import { ReviewCategory } from "../../../components/review-category";
type Evidence={id:string;category:"IDENTITY"|"BUSINESS"|"REVENUE";documentType:string;fileName:string;status:string;reviewNote?:string|null};
type Case={status:string;user:{id:string;name:string;email:string;role:string};evidence:Evidence[]};
const cats=["IDENTITY","BUSINESS","REVENUE"] as const;
export default async function ReviewAccount({params}:{params:Promise<{userId:string}>}){
 const {userId}=await params;const user=await currentUser();if(user.role!=="ADVISOR"&&user.role!=="ADMIN")redirect("/dashboard");
 const data=await api<Case>(`/kyc/${userId}`);
 return <>
  <div className="page-head"><div><Link href="/reviews" className="text-link">Review queue</Link><h1 style={{marginTop:12}}>{data.user.name}</h1>
    <p>{data.user.email} / {sentence(data.user.role)} / {sentence(data.status)}</p></div></div>
  <div className="warning-panel" style={{marginBottom:22}}>These are sample document records. Approval indicates a simulated review, not actual identity, business or revenue verification.</div>
  {cats.filter(cat=>cat==="IDENTITY"||data.user.role==="SELLER").map(cat=>{
    const evidence=data.evidence.filter(e=>e.category===cat);
    const pending=evidence.some(e=>e.status==="SUBMITTED");
    return <section key={cat} className="card" style={{marginBottom:18}}>
      <div className="section-head"><h2 className="section-title">{sentence(cat)}</h2>{pending&&<ReviewCategory userId={userId} category={cat}/>}</div>
      {evidence.length?<div className="table-wrap"><table><thead><tr><th>Document</th><th>Sample file</th><th>Decision</th></tr></thead>
        <tbody>{evidence.map(e=><tr key={e.id}><td>{sentence(e.documentType)}</td><td><a className="text-link" href={(process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000")+"/api/kyc/evidence/"+e.id+"/sample"} target="_blank" rel="noreferrer">{e.fileName}</a></td><td>{sentence(e.status)}</td></tr>)}</tbody>
      </table></div>:<div className="empty"><p>No samples submitted for this section.</p></div>}
    </section>;
  })}
 </>;
}
