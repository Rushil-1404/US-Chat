export const APP_NAME = "Your Chat";
export const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const DISPLAY_NAME_MAX_LENGTH = 40;
export const STATUS_MAX_LENGTH = 140;
export const MESSAGE_PAGE_SIZE = 100;

export const THEME_OPTIONS = ["light", "dark"] as const;
export const LAST_SEEN_OPTIONS = ["everyone", "matches", "nobody"] as const;
export const MEDIA_AUTO_DOWNLOAD_OPTIONS = ["always", "wifi_only", "never"] as const;
export const MESSAGE_TYPES = ["text", "image", "video", "document"] as const;

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export const AUTH_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password", "/auth/callback"];
export const APP_ROUTES = ["/onboarding", "/chats", "/files", "/settings"];
