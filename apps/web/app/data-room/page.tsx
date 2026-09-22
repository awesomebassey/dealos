import { FileSpreadsheet, FileText, LockKeyhole } from "lucide-react";
import { api, type Deal } from "../../lib/api";
import { DataRoomAction } from "../../components/data-room-actions";

type Doc = { id:string; name:string; category:string; contentType:string; sizeBytes:number; createdAt:string };

export default async function DataRoom() {
  const deals = await api<Deal[]>("/deals");
  const deal = deals[0];

  if (!deal) return <div className="empty"><h3>No document room yet</h3><p>Confidential documents become available after you enter an active transaction.</p></div>;

  const docs = await api<Doc[]>(`/data-room/deals/${deal.id}/documents`);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Documents</h1>
          <p>{deal.listing.name} / Confidential deal documents protected by the signed NDA.</p>
        </div>
        <span className="status success"><LockKeyhole size={13}/> NDA access active</span>
      </div>
      <section className="card">
        <div className="section-head"><h2 className="section-title">Data room</h2><span className="muted">{docs.length} files</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Document</th><th>Category</th><th>Size</th><th>Added</th><th></th></tr></thead>
            <tbody>{docs.map((doc) => (
              <tr key={doc.id}>
                <td><div style={{ display:"flex", alignItems:"center", gap:10 }}>{doc.contentType.includes("sheet") || doc.contentType === "text/csv" ? <FileSpreadsheet size={17}/> : <FileText size={17}/>}<strong>{doc.name}</strong></div></td>
                <td>{doc.category}</td>
                <td>{(doc.sizeBytes / 1024 / 1024).toFixed(1)} MB</td>
                <td>{new Date(doc.createdAt).toLocaleDateString("en-NG")}</td>
                <td><DataRoomAction documentId={doc.id} dealId={deal.id}/></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}
