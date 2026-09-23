import { api,currentUser,money,sentence } from "../../lib/api";
import { DemoTopup } from "../../components/demo-topup";
type Wallet={id:string;balanceMinor:string;transactions:Array<{
 id:string;direction:string;type:string;amountMinor:string;createdAt:string;
 deal?:{ref:string;listing:{name:string}}|null;
}>};
export default async function Wallet(){
 const [user,wallet]=await Promise.all([currentUser(),api<Wallet>("/wallet")]);
 return <>
  <div className="page-head"><div><h1>Demo wallet</h1><p>Illustrative funding and acquisition payouts in Naira.</p></div>
    {user.role==="BUYER"&&<DemoTopup/>}</div>
  <div className="card card-pad" style={{maxWidth:650,marginBottom:20,background:"var(--green-dark)",color:"#fff"}}>
    <div style={{fontSize:14,color:"#d2ddd7"}}>Available demo balance</div>
    <div style={{fontSize:40,fontWeight:750,marginTop:10}}>{money(wallet.balanceMinor)}</div>
  </div>
  <section className="card">
    <div className="section-head"><h2 className="section-title">Demo transactions</h2><span className="muted">{wallet.transactions.length} recent movements</span></div>
    {wallet.transactions.length?<div className="table-wrap"><table><thead><tr><th>Activity</th><th>Business</th><th>Amount</th><th>Date</th></tr></thead><tbody>
      {wallet.transactions.map(t=><tr key={t.id}><td>{sentence(t.type)}</td><td>{t.deal?.listing.name||"Sample wallet"}</td>
        <td style={{fontWeight:700,color:t.direction==="CREDIT"?"var(--success)":"var(--ink)"}}>{t.direction==="CREDIT"?"+":"-"}{money(t.amountMinor)}</td><td>{new Date(t.createdAt).toLocaleDateString("en-NG")}</td></tr>)}</tbody></table></div>:
      <div className="empty"><p>No simulated transactions yet.</p></div>}
  </section>
 </>;
}
