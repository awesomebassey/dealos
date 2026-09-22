import Link from "next/link";
import { api,currentUser,money,sentence } from "../../../../lib/api";
import { EscrowActions } from "../../../../components/escrow-actions";
type Deal={id:string;stage:string;listing:{name:string};escrow?:{status:string;amountMinor:string}|null;assetItems:Array<{buyerDone:boolean;sellerDone:boolean}>};
type Escrow={status:string;amountMinor:string;buyerSignedOffAt?:string|null;sellerSignedOffAt?:string|null;platformConfirmedAt?:string|null;
 transactions:Array<{id:string;type:string;status:string;amountMinor:string;createdAt:string}>;};
type Wallet={balanceMinor:string};
export default async function DealEscrow({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const [user,deal]=await Promise.all([currentUser(),api<Deal>(`/deals/${id}`)]);
 if(!deal.escrow)return <div className="card empty"><h3>Escrow opens after an accepted offer</h3><p>The seller must approve a buyer offer before a separate demo escrow account is created for this acquisition.</p><Link href={`/deals/${id}`} className="button">View transaction</Link></div>;
 const [escrow,wallet]=await Promise.all([
   api<Escrow>(`/escrow/deals/${id}`),
   user.role==="BUYER"?api<Wallet>("/wallet"):Promise.resolve(null),
 ]);
 const complete=deal.assetItems.length>0&&deal.assetItems.every(a=>a.buyerDone&&a.sellerDone);
 return <>
  <div className="page-head"><div><h1>Simulated escrow</h1><p>{deal.listing.name} / Track demo funding, handover confirmations and release.</p></div>
    <EscrowActions dealId={id} dealStage={deal.stage} userRole={user.role} status={escrow.status} amountMinor={escrow.amountMinor}
      buyerSigned={!!escrow.buyerSignedOffAt} sellerSigned={!!escrow.sellerSignedOffAt}
      platformConfirmed={!!escrow.platformConfirmedAt} assetsComplete={complete}/></div>
  <div className="warning-panel" style={{marginBottom:20}}>No funds are transferred, held or paid out. All wallet and escrow balances in DealOS are simulated.</div>
  <div className="grid three">
    <div className="card card-pad"><div className="stat-label">Agreed purchase price</div><div className="stat-value">{money(escrow.amountMinor)}</div></div>
    <div className="card card-pad"><div className="stat-label">Escrow status</div><div className="stat-value" style={{fontSize:24}}>{sentence(escrow.status)}</div></div>
    {wallet?<div className="card card-pad"><div className="stat-label">Your demo wallet</div><div className="stat-value">{money(wallet.balanceMinor)}</div>
      <Link className="text-link" href="/wallet">Add simulated funds</Link></div>:<div className="card card-pad"><div className="stat-label">Transfer checklist</div><div className="stat-value">{complete?"Complete":"Pending"}</div>
      <Link className="text-link" href={`/deals/${id}/assets`}>View assets</Link></div>}
  </div>
  <section className="card card-pad" style={{marginTop:18}}><h2 className="section-title">Release conditions</h2>
    <div className="list">{[
      ["All assets confirmed",complete],["Buyer sign-off",!!escrow.buyerSignedOffAt],
      ["Seller sign-off",!!escrow.sellerSignedOffAt],["Advisor confirmation",!!escrow.platformConfirmedAt]
    ].map(([label,done])=><div key={String(label)} className="list-row"><span>{label}</span>
      <span className={`status ${done?"success":"warning"}`}>{done?"Complete":"Pending"}</span></div>)}</div>
  </section>
  <section className="card" style={{marginTop:18}}><div className="section-head"><h2 className="section-title">Escrow activity</h2></div>
    {escrow.transactions.length?<div className="table-wrap"><table><thead><tr><th>Action</th><th>Amount</th><th>Status</th><th>Recorded</th></tr></thead><tbody>
      {escrow.transactions.map(t=><tr key={t.id}><td>{sentence(t.type)}</td><td>{money(t.amountMinor)}</td><td>Demo {sentence(t.status)}</td>
        <td>{new Date(t.createdAt).toLocaleString("en-NG")}</td></tr>)}</tbody></table></div>:<div className="empty"><p>No demo escrow activity yet.</p></div>}
  </section>
 </>;
}
