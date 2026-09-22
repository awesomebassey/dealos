import Link from "next/link";
import { AlertTriangle, BadgeCheck, Landmark, TrendingUp } from "lucide-react";
import { api, type Deal, money } from "../../lib/api";
import { roleFrom } from "../../lib/actors";
import { Severity } from "../../components/severity";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role: raw } = await searchParams; const role = roleFrom(raw);
  const deals = await api<Deal[]>("/deals", role);
  const active = deals.filter((d) => !["COMPLETED","WITHDRAWN"].includes(d.stage));
  const first = deals[0];
  const findings = deals.flatMap((d) => d.findings ?? []);
  const high = findings.filter((f) => ["HIGH","CRITICAL"].includes(f.severity)).length;
  const funded = deals.filter((d) => ["FUNDED","VERIFICATION","RELEASE_PENDING"].includes(d.escrow?.status ?? "")).length;

  return <>
    <div className="page-head"><div><h1>Deal operations</h1><p>Active transactions, diligence risk, verification and escrow status.</p></div></div>
    <div className="grid stats">
      <div className="card card-pad"><div className="kpi"><div className="kpi-icon"><TrendingUp size={18}/></div><div><div className="stat-label">Active deals</div><div className="stat-value">{active.length}</div></div></div><div className="stat-foot">Across the current workspace</div></div>
      <div className="card card-pad"><div className="kpi"><div className="kpi-icon"><AlertTriangle size={18}/></div><div><div className="stat-label">High risk findings</div><div className="stat-value">{high}</div></div></div><div className="stat-foot">Open diligence items</div></div>
      <div className="card card-pad"><div className="kpi"><div className="kpi-icon"><Landmark size={18}/></div><div><div className="stat-label">Escrows funded</div><div className="stat-value">{funded}</div></div></div><div className="stat-foot">Awaiting transfer or release</div></div>
      <div className="card card-pad"><div className="kpi"><div className="kpi-icon"><BadgeCheck size={18}/></div><div><div className="stat-label">Deal value</div><div className="stat-value">{first ? money(first.agreedPriceMinor, first.currency) : "$0"}</div></div></div><div className="stat-foot">Current agreed consideration</div></div>
    </div>

    <div className="grid two" style={{ marginTop:18 }}>
      <section className="card"><div className="section-head"><h2 className="section-title">Active pipeline</h2><Link className="button secondary" href={`/deals?role=${role}`}>View deals</Link></div><div className="table-wrap"><table><thead><tr><th>Deal</th><th>Business</th><th>Stage</th><th>Value</th><th>Risk</th></tr></thead><tbody>{deals.map((deal) => <tr key={deal.id}><td><Link href={`/deals/${deal.id}?role=${role}`}><strong>{deal.ref}</strong></Link></td><td>{deal.listing.name}<div className="stat-foot">{deal.listing.category}</div></td><td><span className="badge gold">{deal.stage.replaceAll("_"," ").toLowerCase()}</span></td><td>{money(deal.agreedPriceMinor, deal.currency)}</td><td>{deal.findings?.[0] ? <Severity value={deal.findings[0].severity}/> : <span className="badge">clear</span>}</td></tr>)}</tbody></table></div></section>
      <section className="card card-pad"><h2 className="section-title">Diligence risk</h2><div style={{ marginTop:18 }}>{findings.slice(0,4).map((finding) => <div className="finding" key={finding.id}><div className="finding-title"><span>{finding.title}</span><Severity value={finding.severity}/></div><p>{finding.detail}</p></div>)}</div></section>
    </div>
  </>;
}
