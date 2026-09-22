import Link from "next/link";
import { api,currentUser,sentence } from "../../../../lib/api";
import { AssetConfirm } from "../../../../components/asset-confirm";
type Item={id:string;label:string;buyerDone:boolean;sellerDone:boolean;completedAt?:string|null};
type Deal={id:string;stage:string;listing:{name:string};assetItems:Item[]};
export default async function AssetTransfer({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const [user,deal]=await Promise.all([currentUser(),api<Deal>(`/deals/${id}`)]);
 return <>
   <div className="page-head"><div><h1>Asset transfer</h1><p>Track the handover of {deal.listing.name} and confirm completion from each side.</p></div></div>
   {deal.stage!=="ASSET_TRANSFER"&&deal.stage!=="COMPLETED"&&<div className="warning-panel" style={{marginBottom:20}}>Asset transfer begins after the accepted offer, closing review and simulated escrow funding.</div>}
   <section className="card">
     <div className="section-head"><h2 className="section-title">Handover checklist</h2><span className="muted">{deal.assetItems.length} items</span></div>
     {deal.assetItems.length?<div className="table-wrap"><table><thead><tr><th>Asset</th><th>Buyer</th><th>Seller</th><th></th></tr></thead>
     <tbody>{deal.assetItems.map(item=><tr key={item.id}><td><strong>{item.label}</strong></td>
       <td><span className={`status ${item.buyerDone?"success":"warning"}`}>{item.buyerDone?"Confirmed":"Pending"}</span></td>
       <td><span className={`status ${item.sellerDone?"success":"warning"}`}>{item.sellerDone?"Confirmed":"Pending"}</span></td>
       <td>{deal.stage==="ASSET_TRANSFER"&&<AssetConfirm dealId={id} itemId={item.id} role={user.role} done={user.role==="BUYER"?item.buyerDone:item.sellerDone}/>}</td></tr>)}</tbody></table></div>:
     <div className="empty"><h3>No handover checklist yet</h3><p>Transfer items are created when the seller accepts an offer.</p></div>}
   </section>
   <p className="muted" style={{marginTop:20}}>Once every item is confirmed by both parties, complete the simulated escrow release checks. <Link className="text-link" href={`/deals/${id}/escrow`}>View escrow</Link></p>
 </>;
}
