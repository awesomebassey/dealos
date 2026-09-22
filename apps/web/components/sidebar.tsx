"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutDashboard, Handshake, FolderLock, ScanSearch, Landmark, BadgeCheck } from "lucide-react";

const items = [
  ["/dashboard", "Overview", LayoutDashboard],
  ["/deals", "Deals", Handshake],
  ["/data-room", "Data room", FolderLock],
  ["/due-diligence", "Due diligence", ScanSearch],
  ["/escrow", "Escrow", Landmark],
  ["/kyc", "Verification", BadgeCheck],
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const params = useSearchParams();
  const role = params.get("role") ?? "buyer";
  return (
    <aside className="sidebar">
      <Link href={`/dashboard?role=${role}`} className="brand">
        <div className="brand-mark">D</div><span>DealOS</span>
      </Link>
      <nav className="nav">
        {items.map(([href, label, Icon]) => (
          <Link key={href} href={`${href}?role=${role}`} className={pathname === href || pathname.startsWith(`${href}/`) ? "active" : ""}>
            <Icon size={17} /><span>{label}</span>
          </Link>
        ))}
      </nav>
      <div className="sidebar-bottom">Acquisition operations<br />Secure transaction workspace</div>
    </aside>
  );
}
