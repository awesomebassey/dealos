"use client";

import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

const workspaceRoots = [
  "/dashboard",
  "/deals",
  "/data-room",
  "/due-diligence",
  "/escrow",
  "/kyc",
  "/account",
  "/my-listings",
  "/wallet",
  "/reviews",
];

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const workspace = workspaceRoots.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  return (
    <>
      {workspace ? (
        <div className="workspace-shell">
          <Sidebar />
          <main className="workspace-main">
            <Topbar />
            <div className="workspace-content">{children}</div>
          </main>
        </div>
      ) : children}
      <Toaster richColors position="top-right" closeButton />
    </>
  );
}
