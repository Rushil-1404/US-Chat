import { redirect } from "next/navigation";

import { getCurrentUser, getProfile } from "@/lib/auth/server";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getProfile(user.id);

  if (!profile?.username) {
    redirect("/onboarding");
  }

  redirect("/chats");
}
