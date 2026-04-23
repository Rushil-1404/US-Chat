import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { getCurrentUser, getProfile } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const user = await getCurrentUser();

  if (user) {
    const profile = await getProfile(user.id);
    redirect(profile?.username ? "/chats" : "/onboarding");
  }

  return (
    <AuthShell
      title="Create your account"
      description="Register with email and password, verify your email, then complete your profile with a username."
    >
      <SignupForm />
    </AuthShell>
  );
}
