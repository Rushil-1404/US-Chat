import { ChatRoom } from "@/components/chats/chat-room";
import { requireOnboardedUser } from "@/lib/auth/server";
import { getConversationPageData } from "@/lib/data/chat";

export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { user } = await requireOnboardedUser();
  const { conversationId } = await params;
  const { conversation, partner, messages } = await getConversationPageData(conversationId, user.id);

  return (
    <ChatRoom
      conversation={conversation}
      currentUserId={user.id}
      partner={partner}
      initialMessages={messages}
    />
  );
}
