"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { ArrowLeft, LoaderCircle, LogOut } from "lucide-react";
import type { ProfileRow, UserSettingsRow } from "@/lib/types";

import { BottomNav } from "@/components/layout/bottom-nav";
import { AvatarChip } from "@/components/ui/avatar-chip";
import { buildAvatarPath } from "@/lib/files";
import { createClient } from "@/lib/supabase/client";
import { settingsSchema } from "@/lib/validators";

type SettingsFormProps = {
  profile: ProfileRow & { avatar_url: string | null };
  settings: UserSettingsRow;
};

export function SettingsForm({ profile, settings }: SettingsFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [statusText, setStatusText] = useState(profile.status_text ?? "");
  const [theme, setTheme] = useState(settings.theme);
  const [notificationsEnabled, setNotificationsEnabled] = useState(settings.notifications_enabled);
  const [readReceiptsEnabled, setReadReceiptsEnabled] = useState(settings.read_receipts_enabled);
  const [lastSeenVisibility, setLastSeenVisibility] = useState(settings.last_seen_visibility);
  const [mediaAutoDownload, setMediaAutoDownload] = useState(settings.media_auto_download);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = settingsSchema.safeParse({
      display_name: displayName,
      status_text: statusText,
      theme,
      notifications_enabled: notificationsEnabled,
      read_receipts_enabled: readReceiptsEnabled,
      last_seen_visibility: lastSeenVisibility,
      media_auto_download: mediaAutoDownload,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Unable to save settings.");
      return;
    }

    setIsSaving(true);
    const supabase = createClient();
    let avatarPath = profile.avatar_path;

    if (avatarFile) {
      avatarPath = buildAvatarPath(profile.id, avatarFile.name);
      const { error: uploadError } = await supabase.storage.from("avatars").upload(avatarPath, avatarFile, {
        upsert: true,
        cacheControl: "3600",
      });

      if (uploadError) {
        setError(uploadError.message);
        setIsSaving(false);
        return;
      }
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        display_name: parsed.data.display_name,
        status_text: parsed.data.status_text || null,
        avatar_path: avatarPath,
      })
      .eq("id", profile.id);

    if (profileError) {
      setError(profileError.message);
      setIsSaving(false);
      return;
    }

    const { error: settingsError } = await supabase
      .from("user_settings")
      .update({
        theme: parsed.data.theme,
        notifications_enabled: parsed.data.notifications_enabled,
        read_receipts_enabled: parsed.data.read_receipts_enabled,
        last_seen_visibility: parsed.data.last_seen_visibility,
        media_auto_download: parsed.data.media_auto_download,
      })
      .eq("user_id", profile.id);

    setIsSaving(false);

    if (settingsError) {
      setError(settingsError.message);
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    startTransition(() => {
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#fafaf8]">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-white/95 px-4 pb-4 pt-10 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/chats")}
            className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand/70">Preferences</p>
            <h1 className="text-2xl font-extrabold text-neutral-950">Settings</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        <form onSubmit={handleSubmit} className="space-y-6 p-4">
          <section className="rounded-[2rem] border border-black/5 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <AvatarChip src={profile.avatar_url} name={profile.display_name} className="h-16 w-16" fallbackClassName="text-xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-extrabold text-neutral-950">{profile.display_name}</p>
                <p className="truncate text-sm text-neutral-500">@{profile.username}</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-neutral-700">Display name</span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm outline-none transition focus:border-brand focus:bg-white"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-neutral-700">Username</span>
                <input
                  value={profile.username}
                  disabled
                  className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-100 px-4 text-sm text-neutral-400 outline-none"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-neutral-700">Status text</span>
                <textarea
                  value={statusText}
                  onChange={(event) => setStatusText(event.target.value)}
                  className="min-h-24 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none transition focus:border-brand focus:bg-white"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-neutral-700">Update avatar</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
                  className="w-full rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500"
                />
              </label>
            </div>
          </section>

          <section className="rounded-[2rem] border border-black/5 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.24em] text-neutral-400">App behavior</h2>
            <div className="space-y-4">
              <label className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-neutral-700">Browser notifications</span>
                <input type="checkbox" checked={notificationsEnabled} onChange={(event) => setNotificationsEnabled(event.target.checked)} />
              </label>
              <label className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-neutral-700">Read receipts</span>
                <input type="checkbox" checked={readReceiptsEnabled} onChange={(event) => setReadReceiptsEnabled(event.target.checked)} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-neutral-700">Theme</span>
                <select
                  value={theme}
                  onChange={(event) => setTheme(event.target.value as UserSettingsRow["theme"])}
                  className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm outline-none transition focus:border-brand focus:bg-white"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-neutral-700">Last seen visibility</span>
                <select
                  value={lastSeenVisibility}
                  onChange={(event) => setLastSeenVisibility(event.target.value as UserSettingsRow["last_seen_visibility"])}
                  className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm outline-none transition focus:border-brand focus:bg-white"
                >
                  <option value="everyone">Everyone</option>
                  <option value="matches">Matches only</option>
                  <option value="nobody">Nobody</option>
                </select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-neutral-700">Media auto-download</span>
                <select
                  value={mediaAutoDownload}
                  onChange={(event) => setMediaAutoDownload(event.target.value as UserSettingsRow["media_auto_download"])}
                  className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm outline-none transition focus:border-brand focus:bg-white"
                >
                  <option value="always">Always</option>
                  <option value="wifi_only">Wi-Fi only</option>
                  <option value="never">Never</option>
                </select>
              </label>
            </div>
          </section>

          {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p> : null}

          <div className="space-y-3">
            <button
              type="submit"
              disabled={isSaving}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand font-semibold text-white shadow-float transition hover:brightness-95 disabled:opacity-60"
            >
              {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Save changes"}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-red-50 font-semibold text-red-600 transition hover:bg-red-100"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </form>
      </main>

      <div className="sticky bottom-0 bg-white/95 backdrop-blur">
        <BottomNav active="settings" />
      </div>
    </div>
  );
}
