import { redirect } from "next/navigation";

import type { ProfileRow, UserSettingsRow } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function getProfile(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle<ProfileRow>();
  return data;
}

export async function getUserSettings(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle<UserSettingsRow>();
  return data;
}

export async function requireOnboardedUser() {
  const user = await requireUser();
  const profile = await getProfile(user.id);

  if (!profile?.username) {
    redirect("/onboarding");
  }

  return { user, profile };
}
