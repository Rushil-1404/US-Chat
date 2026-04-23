import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Choose a new password"
      description="Once this is updated, your new password will be used everywhere you sign in."
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
