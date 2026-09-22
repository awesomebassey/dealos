import Link from "next/link";

export function PublicHeader() {
  return (
    <header className="public-header">
      <Link href="/" className="wordmark">
        <span className="wordmark-mark">D</span>
        <span>DealOS</span>
      </Link>
      <nav className="public-nav" aria-label="Main navigation">
        <Link href="/marketplace">Buy a business</Link>
        <Link href="/register?role=SELLER">Sell a business</Link>
        <Link href="/#how-it-works">How it works</Link>
      </nav>
      <div className="public-actions">
        <Link href="/login" className="text-link">Sign in</Link>
        <Link href="/register" className="button">Create account</Link>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <span>DealOS</span>
      <span>Secure acquisition infrastructure for Nigerian digital businesses.</span>
    </footer>
  );
}
