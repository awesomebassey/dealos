import Link from "next/link";
import { api,currentUser,sentence } from "../../lib/api";
import { redirect } from "next/navigation";
type Item={id:string;status:string;updatedAt:string;user:{id:string;name:string;email:string;role:string};evidence:Array<{category:string;status:string}>};
export default async function ReviewQueue(){
 const user=await currentUser();if(user.role!=="ADVISOR"&&user.role!=="ADMIN")redirect("/dashboard");
 const items=await api<Item[]>("/kyc/review-queue");
 return <>
  <div className="page-head"><div><h1>Sample verification reviews</h1><p>Review submitted demonstration files for buyer and seller onboarding.</p></div></div>
  <div className="warning-panel" style={{marginBottom:20}}>Approvals are simulated and do not confirm anyone's real identity, company status or revenue.</div>
  <section className="card">{items.length?<div className="table-wrap"><table><thead><tr><th>Account</th><th>Role</th><th>Awaiting review</th><th></th></tr></thead><tbody>
    {items.map(item=><tr key={item.id}><td><strong>{item.user.name}</strong><div className="muted">{item.user.email}</div></td>
      <td>{sentence(item.user.role)}</td><td>{item.evidence.filter(e=>e.status==="SUBMITTED").map(e=>sentence(e.category)).join(", ")}</td>
      <td><Link className="button secondary" href={`/reviews/${item.user.id}`}>Review samples</Link></td></tr>)}</tbody></table></div>:
    <div className="empty"><h3>No samples awaiting review</h3><p>Submitted demonstration files will appear here.</p></div>}</section>
 </>;
}
