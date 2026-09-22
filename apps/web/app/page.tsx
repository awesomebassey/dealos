import Link from "next/link";
import {
  BadgeCheck,
  FileLock2,
  Handshake,
  Landmark,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";
import { PublicFooter, PublicHeader } from "../components/public-header";

const steps = [
  ["01", "Find a business", "Review verified Nigerian digital businesses and choose an opportunity that fits your acquisition goals."],
  ["02", "Sign the NDA", "Request access and sign the confidentiality agreement before sensitive financial documents are unlocked."],
  ["03", "Complete diligence", "Review financial, customer, legal and technical information before making a final commitment."],
  ["04", "Close through escrow", "Fund the agreed amount in Naira, confirm asset transfer and release funds after both parties sign off."],
] as const;

const features = [
  [BadgeCheck, "Verified participants", "Identity and business checks establish who is on each side of the transaction before sensitive access is granted."],
  [FileLock2, "Protected data rooms", "Confidential documents stay behind signed NDA access with every document event recorded."],
  [SearchCheck, "Structured due diligence", "Financial, customer, legal and technical risks stay organised with clear questions for the seller."],
  [Landmark, "Protected settlement", "Escrow funding, asset confirmation and release controls keep the closing process deliberate and auditable."],
] as const;

export default function Home() {
  return (
    <div className="public-shell">
      <PublicHeader />
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <h1>Buy or sell a Nigerian digital business with confidence.</h1>
            <p>
              DealOS brings verification, confidential documents, due diligence,
              deal progress and protected settlement into one clear acquisition journey.
            </p>
            <div className="hero-actions">
              <Link href="/marketplace" className="button lime">Browse businesses</Link>
              <Link href="/register?role=SELLER" className="button light">Sell your business</Link>
            </div>
          </div>
          <div className="hero-trust">
            <div className="trust-item"><BadgeCheck size={20}/><div><strong>Verified accounts</strong><span>Buyer and seller identity checks</span></div></div>
            <div className="trust-item"><FileLock2 size={20}/><div><strong>NDA protected</strong><span>Controlled access to confidential files</span></div></div>
            <div className="trust-item"><Handshake size={20}/><div><strong>Guided transactions</strong><span>A clear path from interest to closing</span></div></div>
            <div className="trust-item"><ShieldCheck size={20}/><div><strong>Protected escrow</strong><span>Funds move only after agreed conditions</span></div></div>
          </div>
        </div>
      </section>

      <section className="public-section" id="how-it-works">
        <div className="section-heading">
          <h2>A transaction process you can understand at a glance.</h2>
          <p>Every screen maps to the next decision in the acquisition, so buyers and sellers always know what has happened and what needs attention next.</p>
        </div>
        <div className="process-grid">
          {steps.map(([number, title, description]) => (
            <article className="process-step" key={number}>
              <div className="process-number">{number}</div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="feature-panel">
        <div className="public-section">
          <div className="section-heading">
            <h2>Everything required to move a serious deal forward.</h2>
            <p>The marketplace, transaction workspace and closing controls work as one product instead of separate tools.</p>
          </div>
          <div className="feature-grid">
            {features.map(([Icon, title, description]) => (
              <article className="feature-card" key={title}>
                <div className="feature-icon"><Icon size={21}/></div>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-cta">
        <div>
          <h2>Ready to start your next acquisition or exit?</h2>
          <p>Create an account as a buyer or seller and continue from one secure workspace.</p>
        </div>
        <div className="public-actions">
          <Link href="/register?role=BUYER" className="button lime">I want to buy</Link>
          <Link href="/register?role=SELLER" className="button light">I want to sell</Link>
        </div>
      </section>
      <PublicFooter />
    </div>
  );
}
