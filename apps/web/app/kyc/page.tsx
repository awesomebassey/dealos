import { BadgeCheck, Building2, CircleCheck, Fingerprint } from "lucide-react";
import { api, currentUser, sentence } from "../../lib/api";

type Kyc = {
  status:string;
  identityVerified:boolean;
  businessVerified:boolean;
  revenueVerified:boolean;
  riskScore:number;
  reviewedAt?:string|null;
};

export default async function Verification() {
  const [user, data] = await Promise.all([currentUser(), api<Kyc>("/kyc/me")]);
  const checks = [
    ["Identity", data.identityVerified, Fingerprint],
    ["Business registration", data.businessVerified, Building2],
    ["Revenue evidence", data.revenueVerified, BadgeCheck],
  ] as const;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Verification</h1>
          <p>{user.name} / Complete the checks required before sensitive deal actions.</p>
        </div>
        <span className={`status ${data.status === "VERIFIED" ? "success" : "warning"}`}><CircleCheck size={13}/>{sentence(data.status)}</span>
      </div>

      <div className="grid three">
        <div className="card card-pad"><div className="stat-label">Verification status</div><div className="stat-value" style={{ fontSize:22 }}>{sentence(data.status)}</div></div>
        <div className="card card-pad"><div className="stat-label">Risk score</div><div className="stat-value">{data.riskScore}</div><div className="stat-foot">Lower scores indicate fewer verification concerns</div></div>
        <div className="card card-pad"><div className="stat-label">Last reviewed</div><div className="stat-value" style={{ fontSize:20 }}>{data.reviewedAt ? new Date(data.reviewedAt).toLocaleDateString("en-NG") : "Pending"}</div></div>
      </div>

      <section className="card card-pad" style={{ marginTop:16 }}>
        <h2 className="section-title">Verification checks</h2>
        <div className="grid three" style={{ marginTop:16 }}>
          {checks.map(([label, done, Icon]) => (
            <div className="feature-card" key={label} style={{ minHeight:0, padding:20 }}>
              <div className="feature-icon"><Icon size={18}/></div>
              <h3 style={{ marginTop:16 }}>{label}</h3>
              <span className={`status ${done ? "success" : "warning"}`}>{done ? "Verified" : "Pending review"}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
