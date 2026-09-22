import Link from "next/link";
import { AlertTriangle, ArrowRight, BadgeCheck, Handshake, Landmark } from "lucide-react";
import { api, currentUser, type Deal, money, sentence } from "../../lib/api";
import { Severity } from "../../components/severity";

export default async function Dashboard() {
  const [user, deals] = await Promise.all([currentUser(), api<Deal[]>("/deals")]);
  const active = deals.filter((deal) => !["COMPLETED", "WITHDRAWN"].includes(deal.stage));
  const findings = deals.flatMap((deal) => deal.findings ?? []);
  const high = findings.filter((finding) => ["HIGH", "CRITICAL"].includes(finding.severity)).length;
  const funded = deals.filter((deal) => ["FUNDED", "VERIFICATION", "RELEASE_PENDING"].includes(deal.escrow?.status ?? "")).length;
  const first = deals[0];

  const roleCopy = user.role === "SELLER"
    ? {
        title: `Welcome back, ${user.name.split(" ")[0]}`,
        description: "Track buyer activity, confidential review, transaction progress and closing from one place.",
        emptyTitle: "Your business sale starts here",
        emptyText: "Complete verification and prepare your listing before buyer conversations begin.",
        action: "Complete verification",
        href: "/kyc",
      }
    : user.role === "BUYER"
      ? {
          title: `Welcome back, ${user.name.split(" ")[0]}`,
          description: "Review your active acquisitions and continue from the next outstanding step.",
          emptyTitle: "Find your first acquisition",
          emptyText: "Browse verified Nigerian digital businesses and start a deal when you find the right opportunity.",
          action: "Browse marketplace",
          href: "/marketplace",
        }
      : {
          title: "Deal team workspace",
          description: "Keep active acquisitions moving while monitoring diligence, verification and settlement.",
          emptyTitle: "No active transactions",
          emptyText: "New transactions will appear here when buyers and sellers enter the deal pipeline.",
          action: "View marketplace",
          href: "/marketplace",
        };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{roleCopy.title}</h1>
          <p>{roleCopy.description}</p>
        </div>
        <Link href={roleCopy.href} className="button secondary">{roleCopy.action} <ArrowRight size={14}/></Link>
      </div>

      {!deals.length ? (
        <section className="card empty">
          <h3>{roleCopy.emptyTitle}</h3>
          <p>{roleCopy.emptyText}</p>
          <Link href={roleCopy.href} className="button">{roleCopy.action}</Link>
        </section>
      ) : (
        <>
          <div className="grid stats">
            <div className="card card-pad"><div className="kpi"><div className="kpi-icon"><Handshake size={18}/></div><div><div className="stat-label">Active deals</div><div className="stat-value">{active.length}</div></div></div><div className="stat-foot">Transactions currently in progress</div></div>
            <div className="card card-pad"><div className="kpi"><div className="kpi-icon"><AlertTriangle size={18}/></div><div><div className="stat-label">Priority findings</div><div className="stat-value">{high}</div></div></div><div className="stat-foot">High-risk diligence items still open</div></div>
            <div className="card card-pad"><div className="kpi"><div className="kpi-icon"><Landmark size={18}/></div><div><div className="stat-label">Funded escrows</div><div className="stat-value">{funded}</div></div></div><div className="stat-foot">Deals awaiting transfer or release</div></div>
            <div className="card card-pad"><div className="kpi"><div className="kpi-icon"><BadgeCheck size={18}/></div><div><div className="stat-label">Current deal value</div><div className="stat-value">{first ? money(first.agreedPriceMinor) : "₦0"}</div></div></div><div className="stat-foot">Agreed consideration in Naira</div></div>
          </div>

          <div className="grid two" style={{ marginTop: 16 }}>
            <section className="card">
              <div className="section-head"><h2 className="section-title">Your transactions</h2><Link className="text-link" href="/deals">View all</Link></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Business</th><th>Stage</th><th>Value</th><th>Risk</th></tr></thead>
                  <tbody>{deals.map((deal) => (
                    <tr key={deal.id}>
                      <td><Link href={`/deals/${deal.id}`}><strong>{deal.listing.name}</strong></Link><div className="stat-foot">{deal.ref}</div></td>
                      <td><span className="status active">{sentence(deal.stage)}</span></td>
                      <td>{money(deal.agreedPriceMinor)}</td>
                      <td>{deal.findings?.[0] ? <Severity value={deal.findings[0].severity}/> : <span className="status success">No priority finding</span>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </section>
            <section className="card card-pad">
              <h2 className="section-title">What needs attention</h2>
              <div style={{ marginTop: 12 }}>
                {findings.slice(0, 4).map((finding) => (
                  <div className="finding" key={finding.id}>
                    <div className="finding-title"><span>{finding.title}</span><Severity value={finding.severity}/></div>
                    <p>{finding.detail}</p>
                  </div>
                ))}
                {!findings.length && <div className="empty"><p>No open diligence findings require attention.</p></div>}
              </div>
            </section>
          </div>
        </>
      )}
    </>
  );
}
