import Link from "next/link";
import { notFound } from "next/navigation";
import { api,currentUser,money,sentence } from "../../../lib/api";
import { SellerDocumentUpload } from "../../../components/seller-document-upload";
import { PublishListingButton } from "../../../components/publish-listing-button";

type Own={id:string;slug:string;name:string;category:string;status:string;askingPriceMinor:string};
type Doc={id:string;name:string;category:string;sizeBytes:number;createdAt:string};
type Case={verification:{status:string;businessVerified:boolean;revenueVerified:boolean}};
type Identity={identityVerified:boolean};

export default async function ManageListing({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const user=await currentUser();if(user.role!=="SELLER")notFound();
 const items=await api<Own[]>("/listings/mine");
 const item=items.find(x=>x.slug===slug);if(!item)notFound();
 const [documents,review,identity]=await Promise.all([
  api<Doc[]>(`/data-room/listings/${item.id}/documents`),
  api<Case>(`/listing-verification/${slug}`),
  api<Identity>("/kyc/me"),
 ]);
 const ready=identity.identityVerified&&review.verification.businessVerified&&review.verification.revenueVerified&&
   documents.some(d=>d.category==="Financial");
 return <>
  <div className="page-head">
    <div><Link className="text-link" href="/my-listings">My businesses</Link>
      <h1 style={{marginTop:12}}>{item.name}</h1>
      <p>{item.category} / {money(item.askingPriceMinor)} / {sentence(item.status)}</p>
    </div>
    {["DRAFT","ARCHIVED"].includes(item.status)&&ready&&<PublishListingButton slug={slug}/>}
    {item.status==="PUBLISHED"&&<Link href={`/marketplace/${slug}`} className="button">View public listing</Link>}
  </div>
  <section className="grid three" style={{marginBottom:22}}>
    <Link className="card card-pad" href="/kyc/identity">
      <h2 className="section-title">Personal identity</h2><p className="muted">{identity.identityVerified?"Approved":"Complete identity review"}</p>
      <span className="text-link">{identity.identityVerified?"View account":"Continue"}</span>
    </Link>
    <Link className="card card-pad" href={`/my-listings/${slug}/verification`}>
      <h2 className="section-title">Business registration</h2>
      <p className="muted">{review.verification.businessVerified?"Approved":"Upload and review business records"}</p>
      <span className="text-link">Manage documents</span>
    </Link>
    <Link className="card card-pad" href={`/my-listings/${slug}/verification`}>
      <h2 className="section-title">Revenue evidence</h2>
      <p className="muted">{review.verification.revenueVerified?"Approved":"Upload and review revenue evidence"}</p>
      <span className="text-link">Manage documents</span>
    </Link>
  </section>
  <div className="grid two">
    <section className="card">
      <div className="section-head"><h2 className="section-title">Confidential data room</h2>
        <span className="muted">{documents.length} documents</span></div>
      {documents.length?<div className="table-wrap"><table><thead><tr><th>Document</th><th>Category</th><th>Size</th></tr></thead><tbody>
        {documents.map(d=><tr key={d.id}><td><strong>{d.name}</strong></td>
          <td>{d.category}</td><td>{Math.ceil(d.sizeBytes/1024)} KB</td></tr>)}
      </tbody></table></div>:<div className="empty"><p>Add a financial document to prepare this business for publication.</p></div>}
    </section>
    <SellerDocumentUpload listingId={item.id}/>
  </div>
  {["DRAFT","ARCHIVED"].includes(item.status)&&ready&&
    <div style={{marginTop:20}}><PublishListingButton slug={slug}/></div>}
 </>;
}
