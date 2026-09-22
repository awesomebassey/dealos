"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDown, KeyRound, LogOut, Settings, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { clientApi } from "../lib/client-api";

type User = {
  id: string;
  name: string;
  email: string;
  role: "BUYER" | "SELLER" | "ADVISOR" | "ADMIN";
};

const titles: Record<string, string> = {
  "/dashboard": "Home",
  "/listings": "Marketplace",
  "/deals": "My deals",
  "/data-room": "Documents",
  "/due-diligence": "Due diligence",
  "/escrow": "Escrow",
  "/kyc": "Verification",
  "/account": "Account",
};

function titleFor(path: string) {
  return Object.entries(titles).find(([key]) => path === key || path.startsWith(`${key}/`))?.[1] ?? "DealOS";
}

export function Topbar() {
  const path = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    clientApi<User>("/auth/me", { method: "GET" }, { csrf: false })
      .then(setUser)
      .catch(() => router.replace("/login"));
  }, [router]);

  async function logout() {
    try {
      await clientApi("/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign out");
    }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const currentPassword = String(data.get("currentPassword") ?? "");
    const newPassword = String(data.get("newPassword") ?? "");
    setBusy(true);
    try {
      await clientApi("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      toast.success("Password updated");
      setPasswordOpen(false);
      event.currentTarget.reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update password");
    } finally {
      setBusy(false);
    }
  }

  const initials = user?.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() ?? "DO";

  return (
    <header className="topbar">
      <div className="topbar-title">{titleFor(path)}</div>
      <Dialog.Root open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="user-button" aria-label="Open account menu">
              <span className="avatar">{initials}</span>
              <span className="user-copy">
                <strong>{user?.name ?? "Account"}</strong>
                <span>{user?.role.toLowerCase() ?? "Loading"}</span>
              </span>
              <ChevronDown size={15} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="menu-content" align="end" sideOffset={8}>
              <DropdownMenu.Item className="menu-item" onSelect={() => router.push("/account")}>
                <Settings size={15} /> Account settings
              </DropdownMenu.Item>
              <DropdownMenu.Item className="menu-item" onSelect={() => setPasswordOpen(true)}>
                <KeyRound size={15} /> Change password
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="menu-separator" />
              <DropdownMenu.Item className="menu-item danger" onSelect={logout}>
                <LogOut size={15} /> Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
              <div>
                <Dialog.Title asChild><h2>Change password</h2></Dialog.Title>
                <Dialog.Description>
                  Use a unique password with at least 10 characters.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button className="user-button" aria-label="Close"><X size={18} /></button>
              </Dialog.Close>
            </div>
            <form className="form" onSubmit={changePassword}>
              <div className="field">
                <label htmlFor="current-password">Current password</label>
                <input className="input" id="current-password" name="currentPassword" type="password" autoComplete="current-password" required />
              </div>
              <div className="field">
                <label htmlFor="new-password">New password</label>
                <input className="input" id="new-password" name="newPassword" type="password" autoComplete="new-password" minLength={10} required />
              </div>
              <div className="dialog-actions">
                <Dialog.Close asChild><button type="button" className="button secondary">Cancel</button></Dialog.Close>
                <button className="button" disabled={busy}>{busy ? "Saving" : "Update password"}</button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </header>
  );
}
