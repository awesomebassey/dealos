import Link from "next/link";
import { notFound } from "next/navigation";
import { api,money,sentence } from "../../../lib/api";
import { SellerDocumentUpload } from "../../../components/seller-document-upload";
import { PublishListingButton } from "../../../components/publish-listing-button";
type Own={id:string;slug:string;name:string;category:string;status:string;askingPriceMinor:string};
type Doc={id:string;name:string;category:string;sizeBytes:number;createdAt:string};
export default async function ManageListing({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const mine=await api<Own[]>("/listings/mine");
  const item=mine.find(x=>x.slug===slug);if(!item)notFound();
  const docs=await api<Doc[]>(`/data-room/listings/${item.id}/documents`);
  return <>
    <div className="page-head"><div><Link className="text-link" href="/my-listings">My businesses</Link>
      <h1 style={{marginTop:12}}>{item.name}</h1><p>{item.category} / {money(item.askingPriceMinor)} / {sentence(item.status)}</p></div>
      {["DRAFT","ARCHIVED"].includes(item.status)&&<PublishListingButton slug={slug}/>}</div>
    {["DRAFT","ARCHIVED"].includes(item.status)&&<div className="warning-panel" style={{marginBottom:20}}>
      Publishing requires simulated identity, business and revenue review. <Link className="text-link" href="/kyc">Open verification</Link>
    </div>}
    <div className="grid two">
      <section className="card">
        <div className="section-head"><h2 className="section-title">Confidential documents</h2><span className="muted">{docs.length} files</span></div>
        {docs.length?<div className="table-wrap"><table><thead><tr><th>File</th><th>Category</th><th>Added</th></tr></thead><tbody>{docs.map(d=><tr key={d.id}><td>{d.name}</td><td>{d.category}</td><td>{new Date(d.createdAt).toLocaleDateString("en-NG")}</td></tr>)}</tbody></table></div>:
        <div className="empty"><p>Documents added here become available to buyers only after signing an NDA.</p></div>}
      </section>
      <SellerDocumentUpload listingId={item.id}/>
    </div>
  </>;
}
