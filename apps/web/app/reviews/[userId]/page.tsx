import Link from "next/link";
import { api,currentUser,sentence } from "../../../lib/api";
import { redirect } from "next/navigation";
import { ReviewCategory } from "../../../components/review-category";

type Evidence={id:string;category:string;documentType:string;fileName:string;status:string};
type Case={status:string;user:{id:string;name:string;email:string;role:string};evidence:Evidence[]};
export default async function ReviewIdentity({params}:{params:Promise<{userId:string}>}){
 const {userId}=await params;
 const user=await currentUser();
 if(user.role!=="ADVISOR"&&user.role!=="ADMIN")redirect("/dashboard");
 const data=await api<Case>(`/kyc/${userId}`);
 const evidence=data.evidence.filter(e=>e.category==="IDENTITY");
 const pending=evidence.some(e=>e.status==="SUBMITTED");
 return <>
  <div className="page-head"><div><Link href="/reviews" className="text-link">Verification reviews</Link>
    <h1 style={{marginTop:12}}>{data.user.name}</h1>
    <p>{data.user.email} / Personal identity</p></div></div>
  <section className="card">
    <div className="section-head"><h2 className="section-title">Identity documents</h2>
      {pending&&<ReviewCategory userId={userId} category="IDENTITY"/>}</div>
    {evidence.length?<div className="table-wrap"><table><thead><tr><th>Type</th><th>Document</th><th>Review</th></tr></thead><tbody>
      {evidence.map(item=><tr key={item.id}><td>{sentence(item.documentType)}</td>
        <td><a className="text-link" href={`/api/kyc/evidence/${item.id}/sample`}
          target="_blank" rel="noreferrer">Open {item.fileName}</a></td>
        <td>{sentence(item.status)}</td>
      </tr>)}
    </tbody></table></div>:<div className="empty"><p>No documents submitted for this account.</p></div>}
  </section>
 </>;
}
