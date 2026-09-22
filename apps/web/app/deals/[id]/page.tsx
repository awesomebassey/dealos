import { api, currentUser, money, sentence } from "../../../lib/api";
import { Pipeline } from "../../../components/pipeline";
import { DealActions } from "../../../components/deal-actions";
import { Severity } from "../../../components/severity";

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, deal] = await Promise.all([currentUser(), api<any>(`/deals/${id}`)]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{deal.listing.name}</h1>
          <p>{deal.ref} / {deal.listing.category}</p>
        </div>
        <DealActions dealId={deal.id} stage={deal.stage} version={deal.version} userRole={user.role}/>
      </div>

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Where this deal stands</h2>
            <div className="stat-foot">Follow the acquisition from confidentiality through asset transfer.</div>
          </div>
          <span className="status active">{sentence(deal.stage)}</span>
        </div>
        <Pipeline stage={deal.stage}/>
      </section>

      <div className="grid stats" style={{ marginTop: 16 }}>
        <div className="card card-pad"><div className="stat-label">Agreed price</div><div className="stat-value">{money(deal.agreedPriceMinor)}</div></div>
        <div className="card card-pad"><div className="stat-label">Annual revenue</div><div className="stat-value">{money(deal.listing.annualRevenueMinor)}</div></div>
        <div className="card card-pad"><div className="stat-label">Escrow</div><div className="stat-value" style={{ fontSize: 21 }}>{deal.escrow ? sentence(deal.escrow.status) : "Not opened"}</div></div>
        <div className="card card-pad"><div className="stat-label">Open findings</div><div className="stat-value">{deal.findings.length}</div></div>
      </div>

      <div className="grid two" style={{ marginTop: 16 }}>
        <section className="card card-pad">
          <h2 className="section-title">Recent activity</h2>
          <div className="timeline" style={{ marginTop: 12 }}>
            {deal.auditEvents.map((event: any) => (
              <div className="timeline-item" key={event.id}>
                <div className="timeline-dot"/>
                <div>
                  <div className="timeline-title">{event.metadata?.summary ?? sentence(event.action)}</div>
                  <div className="timeline-meta">{event.actor?.name ?? "System"} / {new Date(event.createdAt).toLocaleString("en-NG")}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="card card-pad">
          <h2 className="section-title">Diligence findings</h2>
          <div style={{ marginTop: 12 }}>
            {deal.findings.map((finding: any) => (
              <div className="finding" key={finding.id}>
                <div className="finding-title"><span>{finding.title}</span><Severity value={finding.severity}/></div>
                <p>{finding.detail}</p>
              </div>
            ))}
            {!deal.findings.length && <div className="empty"><p>No unresolved findings.</p></div>}
          </div>
        </section>
      </div>
    </>
  );
}
