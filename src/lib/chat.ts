export function buildParticipantKey(userA: string, userB: string) {
  return [userA, userB].sort().join(":");
}

export function getPartnerId(conversation: { user_a: string; user_b: string }, currentUserId: string) {
  return conversation.user_a === currentUserId ? conversation.user_b : conversation.user_a;
}

export function messagePreview(payload: {
  text_body: string | null;
  attachment_name: string | null;
  message_type: string | null;
}) {
  if (payload.attachment_name) {
    return payload.attachment_name;
  }

  if (payload.text_body) {
    return payload.text_body;
  }

  if (payload.message_type && payload.message_type !== "text") {
    return "Shared a file";
  }

  return "Start a conversation";
}

export function unreadCount(messages: Array<{ sender_id: string; read_at: string | null }>, currentUserId: string) {
  return messages.filter((message) => message.sender_id !== currentUserId && !message.read_at).length;
}
