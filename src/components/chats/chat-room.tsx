"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, LoaderCircle, LogOut, MoreVertical, Paperclip, Play, Send, Settings, Video } from "lucide-react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { BottomNav } from "@/components/layout/bottom-nav";
import { AvatarChip } from "@/components/ui/avatar-chip";
import { ATTACHMENT_ACCEPT } from "@/lib/constants";
import { buildAttachmentPath, validateAttachment } from "@/lib/files";
import { createClient } from "@/lib/supabase/client";
import type { ConversationRow, MessageRow, MessageView, ProfileRow } from "@/lib/types";
import { cn, formatTimestamp } from "@/lib/utils";
import { messageSchema } from "@/lib/validators";

type ChatRoomProps = {
  conversation: ConversationRow;
  currentUserId: string;
  partner: ProfileRow & { avatar_url: string | null };
  initialMessages: MessageView[];
};

const NEAR_BOTTOM_DISTANCE = 96;

function isScrolledNearBottom(element: Pick<HTMLDivElement, "clientHeight" | "scrollHeight" | "scrollTop">) {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= NEAR_BOTTOM_DISTANCE;
}

function messageStatus(message: MessageView) {
  if (!message.is_mine) {
    return "";
  }

  return message.read_at ? "Read" : "Sent";
}

function upsertMessage(existing: MessageView[], incoming: MessageView) {
  const index = existing.findIndex((message) => message.id === incoming.id);

  if (index === -1) {
    return [...existing, incoming].sort((left, right) => left.created_at.localeCompare(right.created_at));
  }

  const clone = [...existing];
  clone[index] = incoming;
  return clone.sort((left, right) => left.created_at.localeCompare(right.created_at));
}

export function ChatRoom({ conversation, currentUserId, partner, initialMessages }: ChatRoomProps) {
  const router = useRouter();
  const [supabase] = useState(createClient);
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);
  const latestMessageSnapshotRef = useRef<{ id: string | null; count: number } | null>(null);

  useEffect(() => {
    void supabase.rpc("mark_conversation_read", {
      target_conversation_id: conversation.id,
    });
  }, [conversation.id, supabase]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const list = listRef.current;

    if (!list) {
      return;
    }

    const run = () => {
      list.scrollTo({ top: list.scrollHeight, behavior });
      isNearBottomRef.current = true;
    };

    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(run);
      return;
    }

    run();
  }, []);

  useEffect(() => {
    const latestMessage = messages[messages.length - 1];
    const latestId = latestMessage?.id ?? null;
    const previous = latestMessageSnapshotRef.current;
    latestMessageSnapshotRef.current = { id: latestId, count: messages.length };

    if (!previous) {
      scrollToBottom("auto");
      return;
    }

    const hasNewLatestMessage = latestId !== previous.id || messages.length > previous.count;

    if (!hasNewLatestMessage) {
      return;
    }

    if (latestMessage?.sender_id === currentUserId || isNearBottomRef.current) {
      setHasNewMessages(false);
      scrollToBottom("smooth");
      return;
    }

    setHasNewMessages(true);
  }, [currentUserId, messages, scrollToBottom]);

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        async (payload: RealtimePostgresChangesPayload<MessageRow>) => {
          const next = payload.new as MessageRow | undefined;

          if (!next?.id) {
            return;
          }

          const senderId = next.sender_id;
          const sender =
            senderId === partner.id
              ? {
                  username: partner.username,
                  display_name: partner.display_name,
                  avatar_url: partner.avatar_url,
                }
              : null;

          let signedUrl: string | null = null;
          if (next.attachment_path) {
            const { data } = await supabase.storage.from("attachments").createSignedUrl(next.attachment_path, 60 * 60);
            signedUrl = data?.signedUrl ?? null;
          }

          const hydrated: MessageView = {
            ...next,
            sender_username: sender?.username ?? "me",
            sender_display_name: sender?.display_name ?? "You",
            sender_avatar_url: sender?.avatar_url ?? null,
            is_mine: next.sender_id === currentUserId,
            signed_url: signedUrl,
          };

          setMessages((current) => upsertMessage(current, hydrated));

          if (next.sender_id !== currentUserId && !next.read_at) {
            await supabase.rpc("mark_conversation_read", {
              target_conversation_id: conversation.id,
            });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversation.id, currentUserId, partner, supabase]);

  async function sendTextMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = messageSchema.safeParse({ text });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Unable to send that message.");
      return;
    }

    const trimmed = parsed.data.text?.trim();
    if (!trimmed) {
      return;
    }

    const id = crypto.randomUUID();
    const optimisticMessage: MessageView = {
      id,
      conversation_id: conversation.id,
      sender_id: currentUserId,
      message_type: "text",
      text_body: trimmed,
      attachment_path: null,
      attachment_name: null,
      mime_type: null,
      size_bytes: null,
      read_at: null,
      created_at: new Date().toISOString(),
      sender_username: "me",
      sender_display_name: "You",
      sender_avatar_url: null,
      is_mine: true,
      signed_url: null,
    };

    setMessages((current) => upsertMessage(current, optimisticMessage));
    setText("");
    setIsSending(true);

    const { error: insertError } = await supabase.from("messages").insert({
      id,
      conversation_id: conversation.id,
      sender_id: currentUserId,
      message_type: "text",
      text_body: trimmed,
    });
    setIsSending(false);

    if (insertError) {
      setError(insertError.message);
      setMessages((current) => current.filter((message) => message.id !== id));
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setError(null);

    let messageType: MessageView["message_type"];

    try {
      messageType = validateAttachment(file);
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : "Unsupported file.");
      return;
    }

    const id = crypto.randomUUID();
    const attachmentPath = buildAttachmentPath(conversation.id, id, file.name);

    setUploadLabel(`Uploading ${file.name}`);

    const { error: uploadError } = await supabase.storage.from("attachments").upload(attachmentPath, file, {
      upsert: false,
    });

    if (uploadError) {
      setUploadLabel(null);
      setError(uploadError.message);
      return;
    }

    const { data: signedData } = await supabase.storage.from("attachments").createSignedUrl(attachmentPath, 60 * 60);
    const optimisticMessage: MessageView = {
      id,
      conversation_id: conversation.id,
      sender_id: currentUserId,
      message_type: messageType,
      text_body: null,
      attachment_path: attachmentPath,
      attachment_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      read_at: null,
      created_at: new Date().toISOString(),
      sender_username: "me",
      sender_display_name: "You",
      sender_avatar_url: null,
      is_mine: true,
      signed_url: signedData?.signedUrl ?? null,
    };

    setMessages((current) => upsertMessage(current, optimisticMessage));

    const { error: insertError } = await supabase.from("messages").insert({
      id,
      conversation_id: conversation.id,
      sender_id: currentUserId,
      message_type: messageType,
      attachment_path: attachmentPath,
      attachment_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    });

    setUploadLabel(null);

    if (insertError) {
      await supabase.storage.from("attachments").remove([attachmentPath]);
      setError(insertError.message);
      setMessages((current) => current.filter((message) => message.id !== id));
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    startTransition(() => {
      router.replace("/login");
      router.refresh();
    });
  }

  function handleListScroll(event: React.UIEvent<HTMLDivElement>) {
    const nearBottom = isScrolledNearBottom(event.currentTarget);
    isNearBottomRef.current = nearBottom;

    if (nearBottom) {
      setHasNewMessages(false);
    }
  }

  return (
    <div className="relative flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[linear-gradient(180deg,#f5f0e7_0%,#faf8f3_22%,#ffffff_100%)] dark:bg-[linear-gradient(180deg,#111a16_0%,#0d1411_42%,#090d0c_100%)]">
      <header className="z-20 shrink-0 border-b border-black/5 bg-white/95 px-4 pb-3 pt-[calc(2.5rem+env(safe-area-inset-top))] backdrop-blur dark:border-white/10 dark:bg-neutral-950/95">
        <div className="flex items-center justify-between gap-4">
          <Link href="/chats" className="flex min-w-0 items-center gap-3">
            <ArrowLeft className="h-5 w-5 text-neutral-500 dark:text-neutral-300" />
            <div className="relative">
              <AvatarChip src={partner.avatar_url} name={partner.display_name} className="h-10 w-10" />
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-brand dark:border-neutral-950" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-neutral-950 dark:text-neutral-50">{partner.display_name}</p>
              <p className="truncate text-xs text-brand">@{partner.username}</p>
            </div>
          </Link>

          <div className="relative flex items-center gap-2">
            <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-white/10">
              <Video className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-white/10"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-11 w-44 rounded-3xl border border-black/5 bg-white p-2 shadow-float dark:border-white/10 dark:bg-neutral-900">
                <Link
                  href="/settings"
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-white/10"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main
        ref={listRef}
        data-testid="message-list"
        onScroll={handleListScroll}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-5"
      >
        {messages.map((message) => (
          <div key={message.id} className={cn("flex", message.is_mine ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[84%] rounded-[1.5rem] px-4 py-3 shadow-sm",
                message.is_mine
                  ? "rounded-tr-md bg-brand text-white"
                  : "rounded-tl-md bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100",
              )}
            >
              {message.message_type === "text" || !message.attachment_path ? (
                <p className={cn("text-sm leading-6", !message.is_mine && "text-neutral-700 dark:text-neutral-200")}>
                  {message.text_body}
                </p>
              ) : message.message_type === "image" ? (
                <div className="space-y-2">
                  {message.signed_url ? (
                    <Image
                      src={message.signed_url}
                      alt={message.attachment_name ?? "Image"}
                      width={720}
                      height={720}
                      unoptimized
                      className="max-h-72 w-full rounded-[1rem] object-cover"
                    />
                  ) : (
                    <div className="flex h-48 items-center justify-center rounded-[1rem] bg-black/5 text-xs font-semibold text-current/70">
                      Image unavailable
                    </div>
                  )}
                  <p className={cn("text-sm font-semibold", !message.is_mine && "text-neutral-700 dark:text-neutral-200")}>
                    {message.attachment_name}
                  </p>
                </div>
              ) : message.message_type === "video" ? (
                <a
                  href={message.signed_url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className={cn("flex items-center gap-3", !message.is_mine && "text-neutral-700 dark:text-neutral-200")}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/15 text-white">
                    <Play className="ml-0.5 h-4 w-4" />
                  </span>
                  <span className="truncate text-sm font-semibold">{message.attachment_name}</span>
                </a>
              ) : (
                <a
                  href={message.signed_url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className={cn("flex items-center gap-3", !message.is_mine && "text-neutral-700 dark:text-neutral-200")}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-300">
                    <Download className="h-4 w-4" />
                  </span>
                  <span className="truncate text-sm font-semibold">{message.attachment_name}</span>
                </a>
              )}

              <div
                className={cn(
                  "mt-2 flex items-center justify-end gap-2 text-[10px]",
                  message.is_mine ? "text-white/80" : "text-neutral-400 dark:text-neutral-500",
                )}
              >
                <span>{formatTimestamp(message.created_at)}</span>
                {message.is_mine ? <span>{messageStatus(message)}</span> : null}
              </div>
            </div>
          </div>
        ))}
      </main>

      {hasNewMessages ? (
        <button
          type="button"
          onClick={() => {
            setHasNewMessages(false);
            scrollToBottom("smooth");
          }}
          className="absolute bottom-[calc(8rem+env(safe-area-inset-bottom))] left-1/2 z-20 -translate-x-1/2 rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white shadow-float transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
        >
          New messages
        </button>
      ) : null}

      <footer className="z-20 shrink-0 border-t border-black/5 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-white/10 dark:bg-neutral-950/95">
        {uploadLabel ? <p className="px-4 pt-3 text-xs font-medium text-neutral-500 dark:text-neutral-400">{uploadLabel}</p> : null}
        {error ? <p className="px-4 pt-3 text-xs font-medium text-red-600">{error}</p> : null}
        <form onSubmit={sendTextMessage} className="flex items-end gap-2 px-3 py-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-white/10"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <input ref={fileInputRef} type="file" accept={ATTACHMENT_ACCEPT} hidden onChange={handleFileChange} />
          <div className="flex-1 rounded-[1.75rem] border border-transparent bg-neutral-100 px-4 py-3 focus-within:border-brand focus-within:bg-white dark:bg-neutral-900 dark:focus-within:bg-neutral-900">
            <textarea
              rows={1}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Message"
              className="max-h-32 w-full resize-none bg-transparent text-sm text-neutral-950 outline-none placeholder:text-neutral-400 dark:text-neutral-50 dark:placeholder:text-neutral-500"
            />
          </div>
          <button
            type="submit"
            disabled={isSending}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-white shadow-float transition hover:brightness-95 disabled:opacity-60"
          >
            {isSending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
        <BottomNav active="chats" cloudHref={`/files/${conversation.id}`} />
      </footer>
    </div>
  );
}
