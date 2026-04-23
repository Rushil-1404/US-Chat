import type { LAST_SEEN_OPTIONS, MEDIA_AUTO_DOWNLOAD_OPTIONS, MESSAGE_TYPES, THEME_OPTIONS } from "@/lib/constants";

export type ThemeOption = (typeof THEME_OPTIONS)[number];
export type LastSeenVisibility = (typeof LAST_SEEN_OPTIONS)[number];
export type MediaAutoDownload = (typeof MEDIA_AUTO_DOWNLOAD_OPTIONS)[number];
export type MessageType = (typeof MESSAGE_TYPES)[number];

export type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  status_text: string | null;
  created_at: string;
  updated_at: string;
};

export type UserSettingsRow = {
  user_id: string;
  theme: ThemeOption;
  notifications_enabled: boolean;
  read_receipts_enabled: boolean;
  last_seen_visibility: LastSeenVisibility;
  media_auto_download: MediaAutoDownload;
  updated_at: string;
};

export type ChatListItem = {
  conversation_id: string;
  conversation_updated_at: string;
  partner_id: string;
  partner_username: string;
  partner_display_name: string;
  partner_avatar_path: string | null;
  partner_status_text: string | null;
  latest_message_id: string | null;
  latest_message_text: string | null;
  latest_message_type: MessageType | null;
  latest_attachment_name: string | null;
  latest_created_at: string | null;
  unread_count: number;
};

export type ConversationRow = {
  id: string;
  user_a: string;
  user_b: string;
  participant_key: string;
  created_at: string;
  updated_at: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_type: MessageType;
  text_body: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  read_at: string | null;
  created_at: string;
};

export type MessageView = MessageRow & {
  sender_username: string;
  sender_display_name: string;
  sender_avatar_url: string | null;
  is_mine: boolean;
  signed_url: string | null;
};

export type GalleryAsset = {
  id: string;
  conversation_id: string;
  sender_id: string;
  attachment_path: string;
  attachment_name: string;
  mime_type: string;
  size_bytes: number | null;
  created_at: string;
  signed_url: string | null;
  is_mine: boolean;
};
