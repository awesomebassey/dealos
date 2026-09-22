import Link from "next/link";
import { ArrowLeft, BadgeCheck, FileLock2, ShieldCheck, TrendingUp } from "lucide-react";
import { api, money, optionalCurrentUser, publicApi } from "../../../lib/api";
import { PublicFooter, PublicHeader } from "../../../components/public-header";
import { StartDealButton } from "../../../components/start-deal-button";

type Listing = {
  id: string;
  slug: string;
  name: string;
  category: string;
  askingPriceMinor: string;
  annualRevenueMinor: string;
  recurringRevenuePct: number;
  customerConcentration: number;
  ownerHoursPerWeek: number;
  organization: { name: string };
};

export default async function ListingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [listing, user] = await Promise.all([
    publicApi<Listing>(`/listings/${slug}`),
    optionalCurrentUser(),
  ]);

  const verification = user?.role==="BUYER" ? await api<{identityVerified:boolean}>("/kyc/me") : null;
  const next = encodeURIComponent(`/marketplace/${listing.slug}`);

  return (
    <div className="public-shell">
      <PublicHeader />
      <main className="public-section">
        <Link href="/marketplace" className="text-link" style={{ display:"inline-flex", alignItems:"center", gap:7, marginBottom:28 }}>
          <ArrowLeft size={14}/> Back to marketplace
        </Link>

        <div className="page-head">
          <div>
            <h1>{listing.name}</h1>
            <p>{listing.category} / Nigerian digital business</p>
          </div>
          {user?.role === "BUYER" ? (
            verification?.identityVerified?<StartDealButton slug={listing.slug}/>:
              <Link className="button" href="/kyc/identity">Complete sample identity verification</Link>
          ) : user ? (
            <Link href="/dashboard" className="button">Open your workspace</Link>
          ) : (
            <div className="page-actions">
              <Link href={`/login?next=${next}`} className="button secondary">Sign in</Link>
              <Link href={`/register?account=BUYER&next=${next}`} className="button">Create buyer account</Link>
            </div>
          )}
        </div>

        <div className="grid stats">
          <div className="card card-pad"><div className="stat-label">Asking price</div><div className="stat-value">{money(listing.askingPriceMinor)}</div></div>
          <div className="card card-pad"><div className="stat-label">Annual revenue</div><div className="stat-value">{money(listing.annualRevenueMinor)}</div></div>
          <div className="card card-pad"><div className="stat-label">Recurring revenue</div><div className="stat-value">{listing.recurringRevenuePct}%</div></div>
          <div className="card card-pad"><div className="stat-label">Owner involvement</div><div className="stat-value">{listing.ownerHoursPerWeek}h</div><div className="stat-foot">Reported weekly operating time</div></div>
        </div>

        <div className="grid two" style={{ marginTop:18 }}>
          <section className="card card-pad">
            <h2 className="section-title">What happens when you start an acquisition</h2>
            <div className="list" style={{ marginTop:12 }}>
              <div className="list-row"><div style={{display:"flex",gap:11,alignItems:"center"}}><FileLock2 size={18} color="var(--green)"/><span>Review and sign the NDA</span></div></div>
              <div className="list-row"><div style={{display:"flex",gap:11,alignItems:"center"}}><BadgeCheck size={18} color="var(--green)"/><span>Enter the confidential data room</span></div></div>
              <div className="list-row"><div style={{display:"flex",gap:11,alignItems:"center"}}><TrendingUp size={18} color="var(--green)"/><span>Complete financial, customer, legal and technical diligence</span></div></div>
              <div className="list-row"><div style={{display:"flex",gap:11,alignItems:"center"}}><ShieldCheck size={18} color="var(--green)"/><span>Move through offer, escrow and closing</span></div></div>
            </div>
          </section>

          <section className="card card-pad">
            <h2 className="section-title">Commercial profile</h2>
            <div className="list" style={{ marginTop:12 }}>
              <div className="list-row"><span className="muted">Business</span><strong>{listing.organization.name}</strong></div>
              <div className="list-row"><span className="muted">Revenue concentration</span><strong>{listing.customerConcentration}% largest customer</strong></div>
              <div className="list-row"><span className="muted">Confidential records</span><strong>NDA required</strong></div>
              <div className="list-row"><span className="muted">Settlement</span><strong>Protected escrow</strong></div>
            </div>
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
