"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useDeferredValue, useState } from "react";
import { Camera, LoaderCircle, LogOut, MessageSquarePlus, MoreVertical, Search, X } from "lucide-react";

import { BottomNav } from "@/components/layout/bottom-nav";
import { AvatarChip } from "@/components/ui/avatar-chip";
import { createClient } from "@/lib/supabase/client";
import type { ChatListItem, ProfileRow } from "@/lib/types";
import { cn, formatTimestamp } from "@/lib/utils";
import { usernameLookupSchema } from "@/lib/validators";

type ChatShellProps = {
  currentProfile: ProfileRow;
  chats: Array<ChatListItem & { partner_avatar_url: string | null }>;
};

export function ChatShell({ currentProfile, chats }: ChatShellProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const search = useDeferredValue(query.trim().toLowerCase());

  const filteredChats = chats.filter((item) => {
    if (!search) {
      return true;
    }

    return [item.partner_display_name, item.partner_username]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    startTransition(() => {
      router.replace("/login");
      router.refresh();
    });
  }

  async function handleCreateChat(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setModalError(null);

    const parsed = usernameLookupSchema.safeParse({ username });

    if (!parsed.success) {
      setModalError(parsed.error.issues[0]?.message ?? "Enter a valid username.");
      return;
    }

    if (parsed.data.username === currentProfile.username) {
      setModalError("You cannot start a chat with yourself.");
      return;
    }

    setIsCreatingChat(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("find_or_create_direct_conversation", {
      target_username: parsed.data.username,
    });
    setIsCreatingChat(false);

    if (error || !data) {
      setModalError(error?.message ?? "Unable to start that chat.");
      return;
    }

    setModalOpen(false);
    setUsername("");
    startTransition(() => {
      router.push(`/chats/${data}`);
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-white/95 px-5 pb-4 pt-12 backdrop-blur">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand/70">Your Inbox</p>
            <h1 className="text-3xl font-extrabold tracking-tight text-neutral-950">Chats</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100"
            >
              <Camera className="h-5 w-5" />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100"
              >
                <MoreVertical className="h-5 w-5" />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-12 w-48 rounded-3xl border border-black/5 bg-white p-2 shadow-float">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <label className="flex h-12 items-center gap-3 rounded-2xl border border-transparent bg-neutral-100 px-4 focus-within:border-brand focus-within:bg-white">
          <Search className="h-4 w-4 text-neutral-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats"
            className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
          />
        </label>
      </header>

      <main className="relative flex-1 overflow-y-auto pb-24">
        <div className="divide-y divide-black/5">
          {filteredChats.length ? (
            filteredChats.map((chat) => (
              <Link
                key={chat.conversation_id}
                href={`/chats/${chat.conversation_id}`}
                className="flex items-center gap-4 px-5 py-4 transition hover:bg-neutral-50"
              >
                <div className="relative">
                  <AvatarChip
                    src={chat.partner_avatar_url}
                    name={chat.partner_display_name}
                    className="h-14 w-14"
                    fallbackClassName="text-lg"
                  />
                  <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-brand" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[16px] font-semibold text-neutral-900">
                        {chat.partner_display_name}
                      </p>
                      <p className="truncate text-xs font-medium text-neutral-400">@{chat.partner_username}</p>
                    </div>
                    <span className={cn("shrink-0 text-[11px]", chat.unread_count ? "font-semibold text-brand" : "text-neutral-400")}>
                      {formatTimestamp(chat.latest_created_at ?? chat.conversation_updated_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm text-neutral-500">
                      {chat.latest_attachment_name ?? chat.latest_message_text ?? "Start a conversation"}
                    </p>
                    {chat.unread_count ? (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">
                        {chat.unread_count}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="px-6 py-16 text-center">
              <p className="text-lg font-bold text-neutral-900">No chats yet</p>
              <p className="mt-2 text-sm text-neutral-500">Start a direct conversation by username.</p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="fixed bottom-24 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-float transition hover:brightness-95"
        >
          <MessageSquarePlus className="h-5 w-5" />
        </button>
      </main>

      <div className="sticky bottom-0 bg-white/95 backdrop-blur">
        <BottomNav active="chats" />
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-[2rem] border border-black/5 bg-white p-6 shadow-float">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-neutral-950">Start a new chat</h2>
                <p className="text-sm text-neutral-500">Find someone by their username.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setModalError(null);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateChat} className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-neutral-700">Username</span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value.toLowerCase())}
                  className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm outline-none transition focus:border-brand focus:bg-white"
                  placeholder="friend_name"
                />
              </label>

              {modalError ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{modalError}</p> : null}

              <button
                type="submit"
                disabled={isCreatingChat}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand font-semibold text-white shadow-float transition hover:brightness-95 disabled:opacity-60"
              >
                {isCreatingChat ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Open chat"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
