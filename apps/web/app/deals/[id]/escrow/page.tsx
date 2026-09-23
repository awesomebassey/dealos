import Link from "next/link";
import { api,currentUser,money,sentence } from "../../../../lib/api";
import { EscrowActions } from "../../../../components/escrow-actions";
import { CreateEscrowButton } from "../../../../components/create-escrow-button";
type Deal={id:string;stage:string;offer?:{status:string}|null;listing:{name:string};escrow?:{status:string;amountMinor:string}|null;assetItems:Array<{buyerDone:boolean;sellerDone:boolean}>};
type Escrow={status:string;amountMinor:string;buyerSignedOffAt?:string|null;sellerSignedOffAt?:string|null;platformConfirmedAt?:string|null;
 transactions:Array<{id:string;type:string;status:string;amountMinor:string;createdAt:string}>;
 ledgerEntries:Array<{id:string;account:string;direction:string;amountMinor:string;createdAt:string}>;};
type Wallet={balanceMinor:string};
export default async function DealEscrow({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const [user,deal]=await Promise.all([currentUser(),api<Deal>(`/deals/${id}`)]);
 if(!deal.escrow)return <div className="card empty">
   <h3>{deal.offer?.status==="ACCEPTED"?"Ready to open escrow":"An accepted offer starts escrow"}</h3>
   <p>{deal.offer?.status==="ACCEPTED"?
     "The transaction advisor can create a separate escrow account after the closing agreement is prepared.":
     "The buyer and seller must agree on the purchase price before escrow can be opened."}</p>
   {["ADVISOR","ADMIN"].includes(user.role)&&deal.stage==="SPA"&&deal.offer?.status==="ACCEPTED"?
     <CreateEscrowButton dealId={id}/>:<Link href={`/deals/${id}`} className="button">View transaction</Link>}
  </div>;
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
  {["ADVISOR","ADMIN"].includes(user.role)&&deal.stage==="SPA"&&<div className="card card-pad" style={{marginBottom:20}}><h2 className="section-title">Escrow created</h2><p className="muted">Approve the next acquisition stage before the buyer funds this account.</p><Link className="button secondary" href={`/deals/${id}`}>Continue transaction</Link></div>}
  <div className="grid three">
    <div className="card card-pad"><div className="stat-label">Agreed purchase price</div><div className="stat-value">{money(escrow.amountMinor)}</div></div>
    <div className="card card-pad"><div className="stat-label">Escrow status</div><div className="stat-value" style={{fontSize:24}}>{sentence(escrow.status)}</div></div>
    {wallet?<div className="card card-pad"><div className="stat-label">Your demo wallet</div><div className="stat-value">{money(wallet.balanceMinor)}</div>
      <Link className="text-link" href="/wallet">Add simulated funds</Link></div>:<div className="card card-pad"><div className="stat-label">Transfer checklist</div><div className="stat-value">{complete?"Complete":"Pending"}</div>
      <Link className="text-link" href={`/deals/${id}/assets`}>View assets</Link></div>}
  </div>
  <section className="card card-pad" style={{marginTop:18}}>
    <h2 className="section-title">Funds movement</h2>
    <div className="grid three" style={{marginTop:17}}>
      <div className="card card-pad">
        <div className="stat-label">Buyer demo wallet</div>
        <div className="stat-value" style={{fontSize:22}}>{escrow.transactions.some(t=>t.type==="FUND"&&t.status==="SETTLED")?"Debited":"Awaiting funding"}</div>
        <div className="stat-foot">{escrow.transactions.some(t=>t.type==="FUND"&&t.status==="SETTLED")?money(escrow.amountMinor)+" moved to escrow":"No debit recorded"}</div>
      </div>
      <div className="card card-pad">
        <div className="stat-label">Deal escrow</div>
        <div className="stat-value" style={{fontSize:22}}>{escrow.status==="RELEASED"?"Released":escrow.status==="CREATED"?"Awaiting funding":"Funded"}</div>
        <div className="stat-foot">{escrow.status==="RELEASED"?"The escrow account has been settled":escrow.status==="CREATED"?"Buyer funding is the next step":money(escrow.amountMinor)+" allocated to this acquisition"}</div>
      </div>
      <div className="card card-pad">
        <div className="stat-label">Seller demo wallet</div>
        <div className="stat-value" style={{fontSize:22}}>{escrow.status==="RELEASED"?"Credited":"Awaiting release"}</div>
        <div className="stat-foot">{escrow.status==="RELEASED"?money(escrow.amountMinor)+" credited once":"Both parties must finish the handover"}</div>
      </div>
    </div>
  </section>
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
  <section className="card" style={{marginTop:18}}>
    <div className="section-head">
      <h2 className="section-title">Escrow ledger</h2>
      <span className="muted">{escrow.ledgerEntries.length} entries</span>
    </div>
    {escrow.ledgerEntries.length?
      <div className="table-wrap">
        <table>
          <thead><tr><th>Account</th><th>Direction</th><th>Amount</th><th>Recorded</th></tr></thead>
          <tbody>{escrow.ledgerEntries.map(entry=><tr key={entry.id}>
            <td>{sentence(entry.account)}</td>
            <td>{sentence(entry.direction)}</td>
            <td>{money(entry.amountMinor)}</td>
            <td>{new Date(entry.createdAt).toLocaleString("en-NG")}</td>
          </tr>)}</tbody>
        </table>
      </div>:<div className="empty"><p>Ledger entries will appear when this escrow is funded.</p></div>}
  </section>
 </>;
}
