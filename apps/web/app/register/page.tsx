import Link from "next/link";
import { AuthLayout } from "../../components/auth-layout";
import { RegisterForm } from "../../components/auth-forms";

export default function RegisterPage() {
  return (
    <AuthLayout title="Create your account" description="Choose how you are using the marketplace and start from the right workflow.">
      <RegisterForm />
      <div className="form-foot">Already have an account? <Link href="/login" className="text-link">Sign in</Link></div>
    </AuthLayout>
  );
}
