import Link from "next/link";
import { notFound } from "next/navigation";
import { api,currentUser,sentence } from "../../../../lib/api";
import { VerificationUploader } from "../../../../components/verification-uploader";

type Sample={id:string;category:"BUSINESS"|"REVENUE";documentType:string;fileName:string;status:string;reviewNote?:string|null};
type Case={listing:{id:string;name:string;slug:string;status:string};verification:{
 status:string;businessVerified:boolean;revenueVerified:boolean;evidence:Sample[];
}};
const sections=[
 {key:"BUSINESS" as const,label:"Business registration",detail:"CAC certificate, ownership proof and address evidence."},
 {key:"REVENUE" as const,label:"Revenue evidence",detail:"Bank statement and profit and loss statement."},
];
export default async function BusinessVerification({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const user=await currentUser();
 if(user.role!=="SELLER")notFound();
 const result=await api<Case>(`/listing-verification/${slug}`);
 const review=result.verification;
 return <>
  <div className="page-head">
    <div><Link href={`/my-listings/${slug}`} className="text-link">{result.listing.name}</Link>
     <h1 style={{marginTop:12}}>Business verification</h1>
     <p>Documents and revenue evidence for this business are reviewed independently of your other listings.</p>
    </div>
    <span className={`status ${review.status==="VERIFIED"?"success":""}`}>{sentence(review.status)}</span>
  </div>
  <div className="grid two" style={{marginBottom:20}}>
    {sections.map(section=>{
      const approved=section.key==="BUSINESS"?review.businessVerified:review.revenueVerified;
      const docs=review.evidence.filter(e=>e.category===section.key);
      return <section className="card" key={section.key}>
        <div className="section-head"><div><h2 className="section-title">{section.label}</h2><p className="muted" style={{margin:"8px 0 0",fontSize:13}}>{section.detail}</p></div>
          <span className={`status ${approved?"success":""}`}>{approved?"Approved":"Awaiting review"}</span>
        </div>
        {docs.length?<div className="table-wrap"><table><thead><tr><th>Type</th><th>Document</th><th>Decision</th></tr></thead><tbody>
          {docs.map(e=><tr key={e.id}><td>{sentence(e.documentType)}</td><td>{e.fileName}</td>
             <td>{sentence(e.status)}{e.reviewNote&&<p className="muted">{e.reviewNote}</p>}</td></tr>)}
        </tbody></table></div>:<div className="empty"><p>No documents received.</p></div>}
        <div style={{padding:20}}><VerificationUploader category={section.key} listingSlug={slug}/></div>
      </section>;
    })}
  </div>
  <Link href={`/my-listings/${slug}`} className="button secondary">Return to business</Link>
 </>;
}
