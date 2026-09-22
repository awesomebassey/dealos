"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  Files,
  Handshake,
  LayoutDashboard,
  Landmark,
  SearchCheck,
  Store,
} from "lucide-react";

const items = [
  ["/dashboard", "Home", LayoutDashboard],
  ["/marketplace", "Marketplace", Store],
  ["/deals", "My deals", Handshake],
  ["/data-room", "Documents", Files],
  ["/due-diligence", "Due diligence", SearchCheck],
  ["/escrow", "Escrow", Landmark],
  ["/kyc", "Verification", BadgeCheck],
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <Link href="/dashboard" className="wordmark">
        <div className="wordmark-mark">D</div>
        <span>DealOS</span>
      </Link>
      <nav className="nav" aria-label="Workspace navigation">
        {items.map(([href, label, Icon]) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link key={href} href={href} className={active ? "active" : ""}>
              <Icon size={17} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-foot">
        Secure acquisition workspace for Nigerian digital businesses.
      </div>
    </aside>
  );
}
