import Link from "next/link";
import { api,currentUser,sentence } from "../../lib/api";
import { redirect } from "next/navigation";

type Person={id:string;status:string;user:{id:string;name:string;email:string;role:string};
 evidence:Array<{category:string;status:string}>};
type Business={id:string;status:string;listing:{id:string;slug:string;name:string;organization:{name:string}};
 evidence:Array<{category:string;status:string}>};

export default async function ReviewQueue(){
 const user=await currentUser();
 if(user.role!=="ADVISOR"&&user.role!=="ADMIN")redirect("/dashboard");
 const [people,businesses]=await Promise.all([
   api<Person[]>("/kyc/review-queue"),
   api<Business[]>("/listing-verification/review-queue"),
 ]);
 return <>
  <div className="page-head"><div><h1>Verification reviews</h1>
    <p>Review submitted identity documents and the registration and revenue evidence of each business.</p></div></div>
  <section className="card" style={{marginBottom:20}}>
    <div className="section-head"><h2 className="section-title">Personal identity</h2>
      <span className="muted">{people.length} awaiting review</span></div>
    {people.length?<div className="table-wrap"><table><thead><tr><th>Account</th><th>Type</th><th></th></tr></thead><tbody>
      {people.map(item=><tr key={item.id}><td><strong>{item.user.name}</strong><p className="muted">{item.user.email}</p></td>
       <td>{sentence(item.user.role)}</td>
       <td><Link href={`/reviews/${item.user.id}`} className="button secondary">Review identity</Link></td>
      </tr>)}
    </tbody></table></div>:<div className="empty"><p>No identity documents awaiting review.</p></div>}
  </section>
  <section className="card">
    <div className="section-head"><h2 className="section-title">Business and revenue</h2>
      <span className="muted">{businesses.length} businesses awaiting review</span></div>
    {businesses.length?<div className="table-wrap"><table><thead><tr><th>Business</th><th>Owner</th><th>Sections</th><th></th></tr></thead><tbody>
      {businesses.map(item=><tr key={item.id}><td><strong>{item.listing.name}</strong></td>
        <td>{item.listing.organization.name}</td>
        <td>{[...new Set(item.evidence.filter(e=>e.status==="SUBMITTED").map(e=>sentence(e.category)))].join(", ")}</td>
        <td><Link href={`/reviews/businesses/${item.listing.slug}`} className="button secondary">Review business</Link></td>
      </tr>)}
    </tbody></table></div>:<div className="empty"><p>No business documents awaiting review.</p></div>}
  </section>
 </>;
}
