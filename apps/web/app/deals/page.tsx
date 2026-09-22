import Link from "next/link";
import { api, type Deal, money, sentence } from "../../lib/api";

export default async function Deals() {
  const deals = await api<Deal[]>("/deals");

  return (
    <>
      <div className="page-head">
        <div>
          <h1>My deals</h1>
          <p>Open a transaction to see its current stage, confidential documents, diligence and closing progress.</p>
        </div>
      </div>
      <section className="card">
        {deals.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Business</th><th>Reference</th><th>Stage</th><th>Agreed value</th><th>Escrow</th></tr></thead>
              <tbody>
                {deals.map((deal) => (
                  <tr key={deal.id}>
                    <td><Link href={`/deals/${deal.id}`}><strong>{deal.listing.name}</strong></Link><div className="stat-foot">{deal.listing.organization.name}</div></td>
                    <td className="mono">{deal.ref}</td>
                    <td><span className="status active">{sentence(deal.stage)}</span></td>
                    <td>{money(deal.agreedPriceMinor)}</td>
                    <td><span className="status">{deal.escrow ? sentence(deal.escrow.status) : "Not opened"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty"><h3>No deals yet</h3><p>Your active acquisitions or sales will appear here once a transaction begins.</p><Link href="/marketplace" className="button">Browse marketplace</Link></div>
        )}
      </section>
    </>
  );
}
