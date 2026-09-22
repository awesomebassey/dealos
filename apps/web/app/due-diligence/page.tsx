import { api, currentUser, type Deal } from "../../lib/api";
import { DiligenceActions } from "../../components/diligence-actions";
import { Severity } from "../../components/severity";

type Data = {
  findings: Array<{ id:string; title:string; severity:string; detail:string; evidence:Record<string,unknown> }>;
  questions: Array<{ id:string; question:string; answer?:string|null }>;
};

export default async function Diligence() {
  const [user, deals] = await Promise.all([currentUser(), api<Deal[]>("/deals")]);
  const deal = deals[0];

  if (!deal) return <div className="empty"><h3>No diligence workspace yet</h3><p>Diligence starts after a buyer enters an active transaction.</p></div>;

  const data = await api<Data>(`/diligence/deals/${deal.id}`);
  const priority = data.findings.filter((finding) => ["HIGH", "CRITICAL"].includes(finding.severity)).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Due diligence</h1>
          <p>{deal.listing.name} / Review material risks and the questions that still need seller clarification.</p>
        </div>
        {["ADVISOR", "ADMIN"].includes(user.role) && <DiligenceActions dealId={deal.id}/>}
      </div>

      <div className="grid three">
        <div className="card card-pad"><div className="stat-label">Open findings</div><div className="stat-value">{data.findings.length}</div><div className="stat-foot">Items identified in the current review</div></div>
        <div className="card card-pad"><div className="stat-label">Priority findings</div><div className="stat-value">{priority}</div><div className="stat-foot">High-risk items requiring attention</div></div>
        <div className="card card-pad"><div className="stat-label">Seller questions</div><div className="stat-value">{data.questions.length}</div><div className="stat-foot">Open points to resolve before closing</div></div>
      </div>

      <div className="grid two" style={{ marginTop: 16 }}>
        <section className="card card-pad">
          <h2 className="section-title">Risk findings</h2>
          <div style={{ marginTop: 12 }}>
            {data.findings.map((finding) => (
              <div className="finding" key={finding.id}>
                <div className="finding-title"><span>{finding.title}</span><Severity value={finding.severity}/></div>
                <p>{finding.detail}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="card card-pad">
          <h2 className="section-title">Questions for the seller</h2>
          <div className="list" style={{ marginTop: 10 }}>
            {data.questions.map((question, index) => (
              <div className="list-row" key={question.id} style={{ alignItems:"flex-start" }}>
                <strong style={{ color:"var(--green)" }}>{String(index + 1).padStart(2,"0")}</strong>
                <div style={{ lineHeight:1.55, fontSize:13, flex:1 }}>{question.question}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
