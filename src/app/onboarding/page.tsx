import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { getCurrentUser, getProfile } from "@/lib/auth/server";

function defaultDisplayName(email: string | undefined, fallback: string | undefined) {
  if (fallback?.trim()) {
    return fallback;
  }

  if (!email) {
    return "";
  }

  return email.split("@")[0] ?? "";
}

function defaultUsername(email: string | undefined, fallback: string | undefined) {
  const seed = fallback?.trim() || email?.split("@")[0] || "";
  return seed.toLowerCase().replace(/[^a-z0-9_]+/g, "_").slice(0, 20);
}

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getProfile(user.id);

  if (profile?.username) {
    redirect("/chats");
  }

  const suggestedDisplayName = defaultDisplayName(
    user.email,
    typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : undefined,
  );

  const suggestedUsername = defaultUsername(
    user.email,
    typeof user.user_metadata?.user_name === "string" ? user.user_metadata.user_name : undefined,
  );

  return (
    <AuthShell
      title="Finish your profile"
      description="Choose the username people will search for when they want to start a chat with you."
    >
      <OnboardingForm
        user={user}
        suggestedDisplayName={suggestedDisplayName}
        suggestedUsername={suggestedUsername}
      />
    </AuthShell>
  );
}
