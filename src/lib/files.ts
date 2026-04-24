import {
  ALLOWED_DOCUMENT_TYPES,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
} from "@/lib/constants";
import { slugifyFilename } from "@/lib/utils";

export function getMessageTypeFromMime(mimeType: string) {
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    return "image" as const;
  }

  if (ALLOWED_VIDEO_TYPES.includes(mimeType)) {
    return "video" as const;
  }

  if (ALLOWED_DOCUMENT_TYPES.includes(mimeType)) {
    return "document" as const;
  }

  throw new Error("Unsupported file type.");
}

export function validateAttachment(file: File) {
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new Error("The selected file exceeds the 25 MB limit.");
  }

  return getMessageTypeFromMime(file.type);
}

export function buildAvatarPath(userId: string, filename: string) {
  return `${userId}/${slugifyFilename(filename)}`;
}

export function buildAttachmentPath(conversationId: string, messageId: string, filename: string) {
  return `${conversationId}/${messageId}/${slugifyFilename(filename)}`;
}
