import { SettingsForm } from "@/components/settings/settings-form";
import { requireOnboardedUser } from "@/lib/auth/server";
import { getSettingsPageData } from "@/lib/data/chat";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { user } = await requireOnboardedUser();
  const { profile, settings } = await getSettingsPageData(user.id);

  return <SettingsForm profile={profile} settings={settings} />;
}
