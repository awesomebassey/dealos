import { CircleCheck, Clock3, ShieldCheck } from "lucide-react";
import { api, currentUser, type Deal, money, sentence } from "../../lib/api";
import { EscrowActions } from "../../components/escrow-actions";

type Escrow = {
  status:string;
  amountMinor:string;
  buyerSignedOffAt?:string|null;
  sellerSignedOffAt?:string|null;
  platformConfirmedAt?:string|null;
  transactions:Array<{id:string;type:string;status:string;amountMinor:string;provider:string;providerRef:string;createdAt:string}>;
  ledgerEntries:Array<{id:string;account:string;direction:string;amountMinor:string;createdAt:string}>;
};

export default async function Escrow() {
  const [user, deals] = await Promise.all([currentUser(), api<Deal[]>("/deals")]);
  const deal = deals[0];

  if (!deal) return <div className="empty"><h3>No escrow yet</h3><p>Escrow becomes available when an active transaction reaches the closing stage.</p></div>;

  const escrow = await api<Escrow>(`/escrow/deals/${deal.id}`);
  const checks = [
    { label:"Buyer completion", done:!!escrow.buyerSignedOffAt },
    { label:"Seller completion", done:!!escrow.sellerSignedOffAt },
    { label:"Platform confirmation", done:!!escrow.platformConfirmedAt },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Escrow</h1>
          <p>{deal.listing.name} / Track funding, completion confirmation and release.</p>
        </div>
        <EscrowActions
          dealId={deal.id}
          dealStage={deal.stage}
          userRole={user.role}
          status={escrow.status}
          amountMinor={escrow.amountMinor}
          buyerSigned={!!escrow.buyerSignedOffAt}
          sellerSigned={!!escrow.sellerSignedOffAt}
          platformConfirmed={!!escrow.platformConfirmedAt}
        />
      </div>

      <div className="grid two">
        <div className="card card-pad">
          <div className="stat-label">Escrow amount</div>
          <div className="stat-value">{money(escrow.amountMinor)}</div>
          <div className="stat-foot">Agreed transaction value held for this deal</div>
        </div>
        <div className="card card-pad">
          <div className="stat-label">Current status</div>
          <div className="stat-value" style={{ fontSize:22 }}>{sentence(escrow.status)}</div>
          <div className="stat-foot">Funds release only after the required confirmations</div>
        </div>
      </div>

      <div className="grid two" style={{ marginTop:16 }}>
        <section className="card card-pad">
          <h2 className="section-title">Release checks</h2>
          <div className="list" style={{ marginTop:10 }}>
            {checks.map((check) => (
              <div className="list-row" key={check.label}>
                <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                  {check.done ? <CircleCheck size={18} color="var(--success)"/> : <Clock3 size={18} color="var(--warning)"/>}
                  <span>{check.label}</span>
                </div>
                <span className={`status ${check.done ? "success" : "warning"}`}>{check.done ? "Complete" : "Pending"}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card card-pad">
          <h2 className="section-title">Release protection</h2>
          <div className="list" style={{ marginTop:10 }}>
            {[
              "Buyer and seller must both confirm completion",
              "Platform confirmation is required before release",
              "Repeated release requests cannot duplicate a payout",
              "Every escrow movement is recorded in the ledger",
            ].map((label) => (
              <div className="list-row" key={label}>
                <div style={{ display:"flex", gap:10, alignItems:"center" }}><ShieldCheck size={17} color="var(--green)"/><span>{label}</span></div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card" style={{ marginTop:16 }}>
        <div className="section-head"><h2 className="section-title">Escrow activity</h2><span className="muted">{escrow.transactions.length} transactions</span></div>
        {escrow.transactions.length ? (
          <div className="table-wrap"><table><thead><tr><th>Action</th><th>Status</th><th>Amount</th><th>Method</th><th>Reference</th></tr></thead><tbody>{escrow.transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td><strong>{sentence(transaction.type)}</strong></td>
              <td><span className="status success">{sentence(transaction.status)}</span></td>
              <td>{money(transaction.amountMinor)}</td>
              <td>{sentence(transaction.provider)}</td>
              <td className="mono">{transaction.providerRef}</td>
            </tr>
          ))}</tbody></table></div>
        ) : <div className="empty"><p>No escrow transaction has been recorded yet.</p></div>}
      </section>
    </>
  );
}
