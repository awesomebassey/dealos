import Link from "next/link";
import { notFound } from "next/navigation";
import { api,sentence } from "../../../lib/api";
import { VerificationUploader } from "../../../components/verification-uploader";
type Evidence={id:string;category:string;documentType:string;fileName:string;status:string;reviewNote?:string|null;createdAt:string};
type Kyc={evidence:Evidence[];identityVerified:boolean};
export default async function IdentityPage({params}:{params:Promise<{category:string}>}){
 const {category}=await params;if(category!=="identity")notFound();
 const kyc=await api<Kyc>("/kyc/me");
 const evidence=kyc.evidence.filter(e=>e.category==="IDENTITY");
 return <>
  <div className="page-head"><div><Link className="text-link" href="/kyc">Verification</Link>
   <h1 style={{marginTop:12}}>Personal identity</h1>
   <p>Submit one sample identity document for your account.</p></div>
   <span className={`status ${kyc.identityVerified?"success":""}`}>{kyc.identityVerified?"Approved":"Pending"}</span>
  </div>
  <div className="grid two">
   <section className="card"><div className="section-head"><h2 className="section-title">Submitted documents</h2>
     <span className="muted">{evidence.length} files</span></div>
     {evidence.length?<div className="table-wrap"><table><thead><tr><th>Type</th><th>File</th><th>Review</th></tr></thead>
      <tbody>{evidence.map(e=><tr key={e.id}><td>{sentence(e.documentType)}</td><td>{e.fileName}</td>
       <td>{sentence(e.status)}{e.reviewNote&&<p className="muted">{e.reviewNote}</p>}</td></tr>)}</tbody></table></div>:
      <div className="empty"><p>No documents submitted yet.</p></div>}
   </section>
   <VerificationUploader category="IDENTITY"/>
  </div>
 </>;
}
