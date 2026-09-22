import Link from "next/link";
import { AuthLayout } from "../../components/auth-layout";
import { ForgotPasswordForm } from "../../components/auth-forms";

export default function ForgotPasswordPage() {
  return (
    <AuthLayout title="Reset your password" description="Enter the email address connected to your account.">
      <ForgotPasswordForm />
      <div className="form-foot"><Link href="/login" className="text-link">Back to sign in</Link></div>
    </AuthLayout>
  );
}
