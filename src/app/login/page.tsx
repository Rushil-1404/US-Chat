import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser, getProfile } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    const profile = await getProfile(user.id);
    redirect(profile?.username ? "/chats" : "/onboarding");
  }

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in with Google or email and password. Everything else in the app stays behind your authenticated session."
    >
      <LoginForm />
    </AuthShell>
  );
}
