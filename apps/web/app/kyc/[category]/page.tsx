import Link from "next/link";
import { notFound } from "next/navigation";
import { api,currentUser,sentence } from "../../../lib/api";
import { VerificationUploader } from "../../../components/verification-uploader";
type Category="IDENTITY"|"BUSINESS"|"REVENUE";
type Evidence={id:string;category:string;documentType:string;fileName:string;status:string;reviewNote?:string|null;createdAt:string};
type Kyc={evidence:Evidence[];identityVerified:boolean;businessVerified:boolean;revenueVerified:boolean};
const labels:Record<Category,string>={
 IDENTITY:"Personal verification",BUSINESS:"Business verification",REVENUE:"Revenue evidence",
};
const needs:Record<Category,string>={
 IDENTITY:"Submit one synthetic sample. NIN, BVN confirmation, driver's licence or voter card.",
 BUSINESS:"Submit three distinct samples: CAC certificate, proof of ownership and address evidence.",
 REVENUE:"Submit two distinct samples: illustrative bank statement and profit/loss statement.",
};
export default async function VerificationDetail({params}:{params:Promise<{category:string}>}){
 const {category}=await params;const key=category.toUpperCase() as Category;
 if(!["IDENTITY","BUSINESS","REVENUE"].includes(key))notFound();
 const [user,kyc]=await Promise.all([currentUser(),api<Kyc>("/kyc/me")]);
 if(user.role==="BUYER"&&key!=="IDENTITY")notFound();
 const relevant=kyc.evidence.filter(e=>e.category===key);
 const done=key==="IDENTITY"?kyc.identityVerified:key==="BUSINESS"?kyc.businessVerified:kyc.revenueVerified;
 return <>
  <div className="page-head"><div><Link className="text-link" href="/kyc">Account verification</Link><h1 style={{marginTop:12}}>{labels[key]}</h1><p>{needs[key]}</p></div>
  <span className={`status ${done?"success":"warning"}`}>{done?"Demo approved":"Pending"}</span></div>
  <div className="grid two">
    <section className="card"><div className="section-head"><h2 className="section-title">Submitted samples</h2><span className="muted">{relevant.length} files</span></div>
      {relevant.length?<div className="table-wrap"><table><thead><tr><th>Type</th><th>File</th><th>Review</th></tr></thead><tbody>{relevant.map(e=>
        <tr key={e.id}><td>{sentence(e.documentType)}</td><td>{e.fileName}</td><td><span className={`status ${e.status==="APPROVED"?"success":"warning"}`}>{e.status==="APPROVED"?"Demo approved":sentence(e.status)}</span>{e.reviewNote&&<p className="muted">{e.reviewNote}</p>}</td></tr>
      )}</tbody></table></div>:<div className="empty"><p>No sample has been submitted.</p></div>}
    </section>
    <VerificationUploader category={key}/>
  </div>
 </>;
}
