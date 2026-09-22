import { AuthLayout } from "../../components/auth-layout";
import { ResetPasswordForm } from "../../components/auth-forms";

export default function ResetPasswordPage() {
  return (
    <AuthLayout title="Choose a new password" description="Set a new password for your DealOS account.">
      <ResetPasswordForm />
    </AuthLayout>
  );
}
