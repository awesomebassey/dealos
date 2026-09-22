import { api, money } from "../../../lib/api";
import { roleFrom } from "../../../lib/actors";
import { Pipeline } from "../../../components/pipeline";
import { DealActions } from "../../../components/deal-actions";
import { Severity } from "../../../components/severity";

type Detail = Awaited<ReturnType<typeof getDeal>>;
async function getDeal(id:string, role:ReturnType<typeof roleFrom>) { return api<any>(`/deals/${id}`, role); }

export default async function DealPage({ params, searchParams }: { params: Promise<{ id:string }>; searchParams: Promise<{ role?:string }> }) {
  const [{ id }, { role: raw }] = await Promise.all([params, searchParams]); const role=roleFrom(raw); const deal: Detail = await getDeal(id, role);
  return <><div className="page-head"><div><h1>{deal.listing.name}</h1><p>{deal.ref} · {deal.listing.category} · {deal.listing.country}</p></div><DealActions dealId={deal.id} stage={deal.stage} version={deal.version} role={role}/></div>
    <section className="card"><div className="section-head"><h2 className="section-title">Transaction progress</h2><span className="badge gold">{deal.stage.replaceAll("_"," ").toLowerCase()}</span></div><Pipeline stage={deal.stage}/></section>
    <div className="grid stats" style={{ marginTop:18 }}><div className="card card-pad"><div className="stat-label">Agreed price</div><div className="stat-value">{money(deal.agreedPriceMinor, deal.currency)}</div></div><div className="card card-pad"><div className="stat-label">Annual revenue</div><div className="stat-value">{money(deal.listing.annualRevenueMinor, deal.currency)}</div></div><div className="card card-pad"><div className="stat-label">Escrow</div><div className="stat-value" style={{fontSize:21}}>{deal.escrow?.status.replaceAll("_"," ").toLowerCase()}</div></div><div className="card card-pad"><div className="stat-label">Open findings</div><div className="stat-value">{deal.findings.length}</div></div></div>
    <div className="grid two" style={{ marginTop:18 }}><section className="card card-pad"><h2 className="section-title">Activity</h2><div className="timeline" style={{marginTop:12}}>{deal.auditEvents.map((event:any)=><div className="timeline-item" key={event.id}><div className="timeline-dot"/><div><div className="timeline-title">{event.metadata?.summary ?? event.action.replaceAll("_"," ").toLowerCase()}</div><div className="timeline-meta">{event.actor?.name ?? "System"} · {new Date(event.createdAt).toLocaleString()}</div></div></div>)}</div></section><section className="card card-pad"><h2 className="section-title">Open diligence</h2><div style={{marginTop:14}}>{deal.findings.map((f:any)=><div className="finding" key={f.id}><div className="finding-title"><span>{f.title}</span><Severity value={f.severity}/></div><p>{f.detail}</p></div>)}</div></section></div>
  </>;
}
