import Link from "next/link";
import { FileLock2 } from "lucide-react";
import { api, currentUser } from "../../../../lib/api";
import { DataRoomAction } from "../../../../components/data-room-actions";
type Doc={id:string;name:string;category:string;contentType:string;sizeBytes:number;createdAt:string};
type Deal={id:string;stage:string;listing:{name:string};ndaAgreements:Array<{userId:string;status:string}>};
export default async function DealDocuments({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const [user,deal]=await Promise.all([currentUser(),api<Deal>(`/deals/${id}`)]);
 const gated=user.role==="BUYER"&&!deal.ndaAgreements.some(n=>n.userId===user.id&&n.status==="SIGNED");
 if(gated)return <div className="card empty"><FileLock2 size={30}/><h3>Sign the NDA to continue</h3><p>The documents for {deal.listing.name} are confidential until you sign your acquisition NDA.</p><Link href={`/deals/${id}`} className="button">Review NDA</Link></div>;
 const docs=await api<Doc[]>(`/data-room/deals/${id}/documents`);
 return <>
  <div className="page-head"><div><h1>Confidential documents</h1><p>Review the files shared for {deal.listing.name}. Access is recorded for this specific acquisition.</p></div></div>
  <section className="card">
    <div className="section-head"><h2 className="section-title">Data room</h2><span className="muted">{docs.length} files</span></div>
    {docs.length?<div className="table-wrap"><table><thead><tr><th>Document</th><th>Category</th><th>Size</th><th></th></tr></thead><tbody>
      {docs.map(doc=><tr key={doc.id}><td><strong>{doc.name}</strong></td><td>{doc.category}</td><td>{(doc.sizeBytes/1024).toFixed(0)} KB</td>
      <td><DataRoomAction documentId={doc.id} dealId={id}/></td></tr>)}</tbody></table></div>:
      <div className="empty"><h3>No files shared yet</h3><p>The seller can add confidential sample documents from My businesses.</p></div>}
  </section>
 </>;
}
