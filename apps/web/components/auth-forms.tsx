"use client";

import * as Checkbox from "@radix-ui/react-checkbox";
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { clientApi } from "../lib/client-api";

function AccountTypeSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger className="select-trigger" aria-label="Account type">
        <Select.Value />
        <Select.Icon><ChevronDown size={15}/></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="select-content" position="popper" sideOffset={6}>
          <Select.Viewport>
            <Select.Item value="BUYER" className="select-item">
              <Select.ItemText>Buyer account</Select.ItemText>
              <Select.ItemIndicator className="select-indicator"><Check size={14}/></Select.ItemIndicator>
            </Select.Item>
            <Select.Item value="SELLER" className="select-item">
              <Select.ItemText>Seller account</Select.ItemText>
              <Select.ItemIndicator className="select-indicator"><Check size={14}/></Select.ItemIndicator>
            </Select.Item>
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await clientApi("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: String(data.get("email") ?? ""),
          password: String(data.get("password") ?? ""),
        }),
      }, { csrf: false });
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="login-email">Email address</label>
        <input className="input" id="login-email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="field">
        <div className="form-row">
          <label htmlFor="login-password">Password</label>
          <Link href="/forgot-password" className="text-link">Forgot password?</Link>
        </div>
        <input className="input" id="login-password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <button className="button full" disabled={busy}>{busy ? "Signing in" : "Sign in"}</button>
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const requestedRole = params.get("account");
  const [role, setRole] = useState(requestedRole === "SELLER" ? "SELLER" : "BUYER");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accepted) {
      toast.error("Accept the platform terms to continue");
      return;
    }

    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await clientApi("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: String(data.get("name") ?? ""),
          email: String(data.get("email") ?? ""),
          password: String(data.get("password") ?? ""),
          role,
        }),
      }, { csrf: false });
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="register-name">Full name</label>
        <input className="input" id="register-name" name="name" autoComplete="name" required />
      </div>
      <div className="field">
        <label htmlFor="register-email">Email address</label>
        <input className="input" id="register-email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="field">
        <label>Account type</label>
        <AccountTypeSelect value={role} onChange={setRole} />
      </div>
      <div className="field">
        <label htmlFor="register-password">Password</label>
        <input className="input" id="register-password" name="password" type="password" autoComplete="new-password" minLength={10} required />
      </div>
      <label className="checkbox-row">
        <Checkbox.Root className="checkbox-control" checked={accepted} onCheckedChange={(value) => setAccepted(value === true)}>
          <Checkbox.Indicator><Check size={13}/></Checkbox.Indicator>
        </Checkbox.Root>
        <span>I agree to use DealOS for legitimate acquisition activity and protect confidential transaction information.</span>
      </label>
      <button className="button full" disabled={busy}>{busy ? "Creating account" : "Create account"}</button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const result = await clientApi<{ ok: boolean; previewResetToken?: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: String(data.get("email") ?? "") }),
      }, { csrf: false });
      setSent(true);
      if (result.previewResetToken) {
        router.push(`/reset-password?token=${encodeURIComponent(result.previewResetToken)}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to start password reset");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return <div className="notice">If the email belongs to an account, password reset instructions have been created.</div>;
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="forgot-email">Email address</label>
        <input className="input" id="forgot-email" name="email" type="email" autoComplete="email" required />
      </div>
      <button className="button full" disabled={busy}>{busy ? "Sending" : "Continue"}</button>
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await clientApi("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          token,
          password: String(data.get("password") ?? ""),
        }),
      }, { csrf: false });
      toast.success("Password updated. Sign in with your new password.");
      router.replace("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to reset password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="reset-password">New password</label>
        <input className="input" id="reset-password" name="password" type="password" autoComplete="new-password" minLength={10} required />
      </div>
      <button className="button full" disabled={busy || !token}>{busy ? "Saving" : "Set new password"}</button>
      {!token && <div className="notice">Open the password reset link generated for your account.</div>}
    </form>
  );
}
