import { ChatShell } from "@/components/chats/chat-shell";
import { requireOnboardedUser } from "@/lib/auth/server";
import { getChatList } from "@/lib/data/chat";

export const dynamic = "force-dynamic";

export default async function ChatsPage() {
  const { profile } = await requireOnboardedUser();
  const chats = await getChatList();

  return <ChatShell currentProfile={profile} chats={chats} />;
}
