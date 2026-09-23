"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  FileText,
  Handshake,
  LayoutDashboard,
  Landmark,
  SearchCheck,
  Store,
  Wallet,
  ClipboardCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { clientApi } from "../lib/client-api";
type Role = "BUYER" | "SELLER" | "ADVISOR" | "ADMIN";
const common = [
  ["/dashboard", "Home", LayoutDashboard],
  ["/deals", "My deals", Handshake],
  ["/data-room", "Documents", FileText],
  ["/due-diligence", "Due diligence", SearchCheck],
  ["/escrow", "Escrow", Landmark],
] as const;
export function Sidebar() {
  const path = usePathname();
  const [role, setRole] = useState<Role | null>(null);
  useEffect(() => {
    clientApi<{ role: Role }>("/auth/me", { method: "GET" }, { csrf: false })
      .then((u) => setRole(u.role))
      .catch(() => {});
  }, []);
  const items = [
    ...common,
    ...(role === "SELLER"
      ? [["/my-listings", "My businesses", Store] as const]
      : []),
    ...(role === "BUYER" || role === "SELLER"
      ? [
          ["/kyc", "Verification", BadgeCheck] as const,
          ["/wallet", "wallet", Wallet] as const,
        ]
      : []),
    ...(role === "ADVISOR" || role === "ADMIN"
      ? [["/reviews", "Review queue", ClipboardCheck] as const]
      : []),
  ];
  return (
    <aside className="sidebar">
      <Link className="wordmark" href="/dashboard">
        <span className="wordmark-mark">D</span>
        <span>DealOS</span>
      </Link>
      <nav className="nav" aria-label="Workspace navigation">
        {items.map(([href, label, Icon]) => (
          <Link
            key={href}
            href={href}
            className={
              path === href || path.startsWith(`${href}/`) ? "active" : ""
            }
          >
            <Icon size={17} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
