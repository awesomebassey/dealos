import Link from "next/link";
import { ArrowRight, BadgeCheck, TrendingUp } from "lucide-react";
import { money, publicApi } from "../../lib/api";
import { PublicFooter, PublicHeader } from "../../components/public-header";

type Listing = {
  id: string;
  slug: string;
  name: string;
  category: string;
  askingPriceMinor: string;
  annualRevenueMinor: string;
  recurringRevenuePct: number;
  organization: { name: string };
};

export default async function Marketplace() {
  const listings = await publicApi<Listing[]>("/listings");

  return (
    <div className="public-shell">
      <PublicHeader />
      <main className="public-section">
        <div className="section-heading">
          <h2>Verified Nigerian businesses ready for acquisition.</h2>
          <p>Review the commercial profile first. Confidential financial and legal documents unlock only after you join the deal and complete the NDA.</p>
        </div>
        <div className="feature-grid">
          {listings.map((listing) => (
            <article className="feature-card" key={listing.id}>
              <div className="feature-icon"><BadgeCheck size={20}/></div>
              <h3>{listing.name}</h3>
              <p>{listing.category}</p>
              <div className="list" style={{ marginTop: 24 }}>
                <div className="list-row"><span className="muted">Asking price</span><strong>{money(listing.askingPriceMinor)}</strong></div>
                <div className="list-row"><span className="muted">Annual revenue</span><strong>{money(listing.annualRevenueMinor)}</strong></div>
                <div className="list-row"><span className="muted">Recurring revenue</span><strong>{listing.recurringRevenuePct}%</strong></div>
              </div>
              <Link href={`/marketplace/${listing.slug}`} className="button full" style={{ marginTop: 22 }}>
                View business <ArrowRight size={15}/>
              </Link>
            </article>
          ))}
          <article className="feature-card" style={{ background: "var(--green-dark)", color: "#fff" }}>
            <div className="feature-icon"><TrendingUp size={20}/></div>
            <h3>Selling a digital business?</h3>
            <p style={{ color: "#c5d4cd" }}>Create a seller account to prepare your verification, confidential documents and transaction workspace.</p>
            <Link href="/register?account=SELLER" className="button lime" style={{ marginTop: 22 }}>Start your sale</Link>
          </article>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
