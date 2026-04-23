"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { User } from "@supabase/supabase-js";

import { buildAvatarPath } from "@/lib/files";
import { createClient } from "@/lib/supabase/client";
import { onboardingSchema } from "@/lib/validators";

type OnboardingFormProps = {
  user: User;
  suggestedDisplayName: string;
  suggestedUsername: string;
};

export function OnboardingForm({
  user,
  suggestedDisplayName,
  suggestedUsername,
}: OnboardingFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(suggestedDisplayName);
  const [username, setUsername] = useState(suggestedUsername);
  const [statusText, setStatusText] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = onboardingSchema.safeParse({
      username: username.toLowerCase(),
      display_name: displayName,
      status_text: statusText,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Unable to finish setup.");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();

    let avatarPath: string | null = null;

    if (avatarFile) {
      avatarPath = buildAvatarPath(user.id, avatarFile.name);
      const { error: uploadError } = await supabase.storage.from("avatars").upload(avatarPath, avatarFile, {
        cacheControl: "3600",
        upsert: true,
      });

      if (uploadError) {
        setError(uploadError.message);
        setIsSubmitting(false);
        return;
      }
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      username: parsed.data.username,
      display_name: parsed.data.display_name,
      status_text: parsed.data.status_text || null,
      avatar_path: avatarPath,
    });

    if (profileError) {
      setError(profileError.code === "23505" ? "That username is already taken." : profileError.message);
      setIsSubmitting(false);
      return;
    }

    const { error: settingsError } = await supabase.from("user_settings").upsert({
      user_id: user.id,
      theme: "light",
      notifications_enabled: true,
      read_receipts_enabled: true,
      last_seen_visibility: "everyone",
      media_auto_download: "wifi_only",
    });

    setIsSubmitting(false);

    if (settingsError) {
      setError(settingsError.message);
      return;
    }

    startTransition(() => {
      router.replace("/chats");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <label className="block space-y-2">
        <span className="text-sm font-medium text-neutral-700">Display name</span>
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm outline-none transition focus:border-brand focus:bg-white"
          placeholder="How should people see you?"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-neutral-700">Username</span>
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value.toLowerCase())}
          className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm outline-none transition focus:border-brand focus:bg-white"
          placeholder="pick_a_username"
        />
        <span className="text-xs text-neutral-400">Lowercase letters, numbers, and underscores only.</span>
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-neutral-700">Status</span>
        <textarea
          value={statusText}
          onChange={(event) => setStatusText(event.target.value)}
          className="min-h-24 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none transition focus:border-brand focus:bg-white"
          placeholder="Add a short note for your profile"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-neutral-700">Avatar (optional)</span>
        <input
          type="file"
          accept="image/*"
          onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
          className="w-full rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500"
        />
      </label>

      {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand font-semibold text-white shadow-float transition hover:brightness-95 disabled:opacity-60"
      >
        {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Finish setup"}
      </button>
    </form>
  );
}
