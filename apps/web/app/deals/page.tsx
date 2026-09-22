import Link from "next/link";
import { api, type Deal, money } from "../../lib/api";
import { roleFrom } from "../../lib/actors";

export default async function Deals({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role: raw } = await searchParams; const role = roleFrom(raw); const deals = await api<Deal[]>("/deals", role);
  return <><div className="page-head"><div><h1>Deal pipeline</h1><p>Transactions from confidentiality through settlement.</p></div></div><section className="card"><div className="table-wrap"><table><thead><tr><th>Reference</th><th>Business</th><th>Country</th><th>Stage</th><th>Agreed value</th><th>Escrow</th></tr></thead><tbody>{deals.map((deal) => <tr key={deal.id}><td><Link href={`/deals/${deal.id}?role=${role}`}><strong>{deal.ref}</strong></Link></td><td>{deal.listing.name}<div className="stat-foot">{deal.listing.organization.name}</div></td><td>{deal.listing.country}</td><td><span className="badge gold">{deal.stage.replaceAll("_"," ").toLowerCase()}</span></td><td>{money(deal.agreedPriceMinor, deal.currency)}</td><td><span className="badge">{deal.escrow?.status.toLowerCase().replaceAll("_"," ") ?? "not opened"}</span></td></tr>)}</tbody></table></div></section></>;
}
