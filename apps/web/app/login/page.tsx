import Link from "next/link";
import { AuthLayout } from "../../components/auth-layout";
import { LoginForm } from "../../components/auth-forms";

export default function LoginPage() {
  return (
    <AuthLayout title="Welcome back" description="Sign in to continue your acquisition or sale.">
      <LoginForm />
      <div className="form-foot">New to DealOS? <Link href="/register" className="text-link">Create an account</Link></div>
    </AuthLayout>
  );
}
