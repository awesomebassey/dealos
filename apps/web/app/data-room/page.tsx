import { FileSpreadsheet, FileText, LockKeyhole } from "lucide-react";
import { api, type Deal } from "../../lib/api";
import { roleFrom } from "../../lib/actors";
import { DataRoomAction } from "../../components/data-room-actions";

type Doc = { id:string; name:string; category:string; contentType:string; sizeBytes:number; createdAt:string };

export default async function DataRoom({ searchParams }: { searchParams: Promise<{ role?:string }> }) {
  const { role:raw }=await searchParams; const role=roleFrom(raw); const deals=await api<Deal[]>("/deals",role); const deal=deals[0];
  if(!deal) return <div className="empty">No active deal.</div>;
  const docs=await api<Doc[]>(`/data-room/deals/${deal.id}/documents`,role);
  return <><div className="page-head"><div><h1>Data room</h1><p>{deal.listing.name} · NDA protected</p></div><span className="badge"><LockKeyhole size={13}/> access controlled</span></div><section className="card"><div className="section-head"><h2 className="section-title">Transaction documents</h2><span className="muted">{docs.length} files</span></div><div className="table-wrap"><table><thead><tr><th>Document</th><th>Category</th><th>Size</th><th>Added</th><th></th></tr></thead><tbody>{docs.map(doc=><tr key={doc.id}><td><div style={{display:"flex",alignItems:"center",gap:10}}>{doc.contentType.includes("sheet")||doc.contentType==="text/csv"?<FileSpreadsheet size={17}/>:<FileText size={17}/>}<strong>{doc.name}</strong></div></td><td><span className="badge">{doc.category}</span></td><td>{(doc.sizeBytes/1024/1024).toFixed(1)} MB</td><td>{new Date(doc.createdAt).toLocaleDateString()}</td><td><DataRoomAction documentId={doc.id} dealId={deal.id} role={role}/></td></tr>)}</tbody></table></div></section></>;
}
