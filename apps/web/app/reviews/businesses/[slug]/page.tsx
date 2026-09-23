import Link from "next/link";
import { notFound } from "next/navigation";
import { api,currentUser,sentence } from "../../../../lib/api";
import { ListingReviewAction } from "../../../../components/listing-review-action";

type Evidence={id:string;category:string;documentType:string;fileName:string;status:string;reviewNote?:string|null};
type Review={listing:{id:string;slug:string;name:string};verification:{
 status:string;businessVerified:boolean;revenueVerified:boolean;evidence:Evidence[];
}};
export default async function BusinessReview({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const user=await currentUser();
 if(user.role!=="ADVISOR"&&user.role!=="ADMIN")notFound();
 const data=await api<Review>(`/listing-verification/${slug}`);
 const sections=[
  {category:"BUSINESS" as const,title:"Business registration"},
  {category:"REVENUE" as const,title:"Revenue evidence"},
 ];
 return <>
  <div className="page-head"><div>
    <Link href="/reviews" className="text-link">Verification reviews</Link>
    <h1 style={{marginTop:12}}>{data.listing.name}</h1>
    <p>Review the registration and revenue samples for this business.</p>
  </div></div>
  {sections.map(section=>{
    const docs=data.verification.evidence.filter(e=>e.category===section.category);
    const pending=docs.some(e=>e.status==="SUBMITTED");
    const approved=section.category==="BUSINESS"?data.verification.businessVerified:data.verification.revenueVerified;
    return <section className="card" key={section.category} style={{marginBottom:20}}>
      <div className="section-head"><h2 className="section-title">{section.title}</h2>
        {pending&&<ListingReviewAction slug={slug} category={section.category}/>}
        {!pending&&<span className={`status ${approved?"success":""}`}>{approved?"Approved":"No pending files"}</span>}
      </div>
      {docs.length?<div className="table-wrap"><table><thead><tr><th>Document</th><th>File</th><th>Review</th><th></th></tr></thead><tbody>
        {docs.map(e=><tr key={e.id}>
          <td>{sentence(e.documentType)}</td><td>{e.fileName}</td><td>{sentence(e.status)}</td>
          <td><a className="button secondary" href={`/api/listing-verification/${slug}/evidence/${e.id}/sample`}
            target="_blank" rel="noreferrer">Open document</a></td>
        </tr>)}
      </tbody></table></div>:<div className="empty"><p>No documents in this section.</p></div>}
    </section>;
  })}
 </>;
}
