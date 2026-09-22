import Link from "next/link";
import { BadgeCheck, FileLock2, Landmark, Workflow } from "lucide-react";

export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Link href="/" className="wordmark">
          <span className="wordmark-mark">D</span>
          <span>DealOS</span>
        </Link>
        <div>
          <h1>One secure path from interest to ownership.</h1>
          <p>
            Keep identity verification, confidential documents, diligence,
            transaction progress and protected settlement connected to the same deal.
          </p>
        </div>
        <div className="auth-points">
          <div className="auth-point"><BadgeCheck size={18}/><span>Verified buyer and seller accounts</span></div>
          <div className="auth-point"><FileLock2 size={18}/><span>NDA controlled access to confidential documents</span></div>
          <div className="auth-point"><Workflow size={18}/><span>A clear acquisition path with every action recorded</span></div>
          <div className="auth-point"><Landmark size={18}/><span>Naira escrow with dual-party release controls</span></div>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <Link href="/" className="wordmark">
            <span className="wordmark-mark">D</span>
            <span>DealOS</span>
          </Link>
          <h2>{title}</h2>
          <p>{description}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
