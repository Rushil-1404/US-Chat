import { redirect } from "next/navigation";

import { MESSAGE_PAGE_SIZE } from "@/lib/constants";
import type {
  ChatListItem,
  ConversationRow,
  GalleryAsset,
  MessageRow,
  MessageView,
  ProfileRow,
  UserSettingsRow,
} from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

function withAvatarUrl(supabase: Awaited<ReturnType<typeof createClient>>, profile: ProfileRow) {
  const avatarUrl = profile.avatar_path
    ? supabase.storage.from("avatars").getPublicUrl(profile.avatar_path).data.publicUrl
    : null;

  return {
    ...profile,
    avatar_url: avatarUrl,
  };
}

export async function getChatList() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_chat_list");

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as ChatListItem[];

  return rows.map((item: ChatListItem) => ({
    ...item,
    partner_avatar_url: item.partner_avatar_path
      ? supabase.storage.from("avatars").getPublicUrl(item.partner_avatar_path).data.publicUrl
      : null,
  }));
}

export async function getConversationPageData(conversationId: string, currentUserId: string) {
  const supabase = await createClient();
  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle<ConversationRow>();

  if (conversationError) {
    throw new Error(conversationError.message);
  }

  if (!conversation || ![conversation.user_a, conversation.user_b].includes(currentUserId)) {
    redirect("/chats");
  }

  const partnerId = conversation.user_a === currentUserId ? conversation.user_b : conversation.user_a;

  const [{ data: partner, error: partnerError }, { data: messages, error: messagesError }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", partnerId).single<ProfileRow>(),
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(MESSAGE_PAGE_SIZE)
      .returns<MessageRow[]>(),
  ]);

  if (partnerError) {
    throw new Error(partnerError.message);
  }

  if (messagesError) {
    throw new Error(messagesError.message);
  }

  const orderedMessages = [...(messages ?? [])].reverse();
  const senderIds = [...new Set(orderedMessages.map((message) => message.sender_id))];
  const { data: senderProfiles, error: senderProfilesError } = await supabase
    .from("profiles")
    .select("*")
    .in("id", senderIds)
    .returns<ProfileRow[]>();

  if (senderProfilesError) {
    throw new Error(senderProfilesError.message);
  }

  const senderMap = new Map(
    (senderProfiles ?? []).map((profile) => [profile.id, withAvatarUrl(supabase, profile)]),
  );

  const attachmentPaths = orderedMessages
    .map((message) => message.attachment_path)
    .filter((value): value is string => Boolean(value));

  const signedUrls =
    attachmentPaths.length > 0
      ? await supabase.storage.from("attachments").createSignedUrls(attachmentPaths, 60 * 60)
      : { data: [] as Array<{ path: string; signedUrl: string }>, error: null };

  if (signedUrls.error) {
    throw new Error(signedUrls.error.message);
  }

  const signedUrlMap = new Map(
    (signedUrls.data ?? []).map((item) => [item.path, item.signedUrl]),
  );

  return {
    conversation,
    partner: withAvatarUrl(supabase, partner),
    messages: orderedMessages.map((message) => {
      const sender = senderMap.get(message.sender_id);

      return {
        ...message,
        sender_username: sender?.username ?? "unknown",
        sender_display_name: sender?.display_name ?? "Unknown User",
        sender_avatar_url: sender?.avatar_url ?? null,
        is_mine: message.sender_id === currentUserId,
        signed_url: message.attachment_path ? signedUrlMap.get(message.attachment_path) ?? null : null,
      } satisfies MessageView;
    }),
  };
}

export async function getGalleryPageData(conversationId: string, currentUserId: string) {
  const supabase = await createClient();
  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle<ConversationRow>();

  if (conversationError) {
    throw new Error(conversationError.message);
  }

  if (!conversation || ![conversation.user_a, conversation.user_b].includes(currentUserId)) {
    redirect("/chats");
  }

  const partnerId = conversation.user_a === currentUserId ? conversation.user_b : conversation.user_a;

  const [{ data: partner, error: partnerError }, { data: rows, error: rowsError }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", partnerId).single<ProfileRow>(),
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .not("attachment_path", "is", null)
      .order("created_at", { ascending: false })
      .returns<MessageRow[]>(),
  ]);

  if (partnerError) {
    throw new Error(partnerError.message);
  }

  if (rowsError) {
    throw new Error(rowsError.message);
  }

  const attachmentPaths = (rows ?? [])
    .map((row) => row.attachment_path)
    .filter((value): value is string => Boolean(value));

  const signedUrls =
    attachmentPaths.length > 0
      ? await supabase.storage.from("attachments").createSignedUrls(attachmentPaths, 60 * 60)
      : { data: [] as Array<{ path: string; signedUrl: string }>, error: null };

  if (signedUrls.error) {
    throw new Error(signedUrls.error.message);
  }

  const signedUrlMap = new Map((signedUrls.data ?? []).map((item) => [item.path, item.signedUrl]));

  return {
    partner: withAvatarUrl(supabase, partner),
    assets: (rows ?? []).map((row) => ({
      id: row.id,
      conversation_id: row.conversation_id,
      sender_id: row.sender_id,
      attachment_path: row.attachment_path!,
      attachment_name: row.attachment_name!,
      mime_type: row.mime_type!,
      size_bytes: row.size_bytes,
      created_at: row.created_at,
      signed_url: signedUrlMap.get(row.attachment_path!) ?? null,
      is_mine: row.sender_id === currentUserId,
    }) satisfies GalleryAsset),
  };
}

export async function getSettingsPageData(userId: string) {
  const supabase = await createClient();
  const [{ data: profile, error: profileError }, { data: settings, error: settingsError }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single<ProfileRow>(),
    supabase.from("user_settings").select("*").eq("user_id", userId).single<UserSettingsRow>(),
  ]);

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (settingsError) {
    throw new Error(settingsError.message);
  }

  return {
    profile: withAvatarUrl(supabase, profile),
    settings,
  };
}
