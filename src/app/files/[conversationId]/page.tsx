import { SharedFiles } from "@/components/chats/shared-files";
import { requireOnboardedUser } from "@/lib/auth/server";
import { getGalleryPageData } from "@/lib/data/chat";

export const dynamic = "force-dynamic";

export default async function FilesPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { user } = await requireOnboardedUser();
  const { conversationId } = await params;
  const { partner, assets } = await getGalleryPageData(conversationId, user.id);

  return <SharedFiles conversationId={conversationId} partner={partner} assets={assets} />;
}
