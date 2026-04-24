"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useMemo, useState } from "react";
import { ArrowLeft, FileText, LoaderCircle, Play, Trash2 } from "lucide-react";

import { BottomNav } from "@/components/layout/bottom-nav";
import type { GalleryAsset, ProfileRow } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { cn, formatTimestamp } from "@/lib/utils";

type SharedFilesProps = {
  conversationId: string;
  partner: ProfileRow & { avatar_url: string | null };
  assets: GalleryAsset[];
};

type FileFilter = "all" | "image" | "video" | "document";

export function SharedFiles({ conversationId, partner, assets }: SharedFilesProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<FileFilter>("all");
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const filteredAssets = useMemo(() => {
    if (filter === "all") {
      return assets;
    }

    return assets.filter((asset) =>
      filter === "image"
        ? asset.mime_type.startsWith("image/")
        : filter === "video"
          ? asset.mime_type.startsWith("video/")
          : !asset.mime_type.startsWith("image/") && !asset.mime_type.startsWith("video/"),
    );
  }, [assets, filter]);

  async function handleDelete(asset: GalleryAsset) {
    setIsDeleting(asset.id);
    const supabase = createClient();
    const { error: removeError } = await supabase.storage.from("attachments").remove([asset.attachment_path]);

    if (!removeError) {
      await supabase
        .from("messages")
        .update({
          attachment_path: null,
          attachment_name: null,
          mime_type: null,
          size_bytes: null,
          text_body: "File removed",
        })
        .eq("id", asset.id)
        .eq("sender_id", asset.sender_id);
    }

    setIsDeleting(null);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-neutral-950">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-white/95 px-5 pb-4 pt-10 backdrop-blur dark:border-white/10 dark:bg-neutral-950/95">
        <Link href="/chats" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 dark:text-neutral-300">
          <ArrowLeft className="h-4 w-4" />
          Back to chats
        </Link>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand/70">Shared Cloud</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-950 dark:text-neutral-50">{partner.display_name}</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{assets.length} shared files</p>
        </div>
        <div className="mt-5 flex gap-3 overflow-x-auto pb-1">
          {(["all", "image", "video", "document"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                filter === item ? "bg-brand text-white" : "bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-300",
              )}
            >
              {item === "all" ? "All Files" : item === "image" ? "Images" : item === "video" ? "Videos" : "Docs"}
            </button>
          ))}
        </div>
      </header>

      <main className="grid flex-1 grid-cols-2 gap-3 p-4 pb-24">
        {filteredAssets.length ? (
          filteredAssets.map((asset) => (
            <article key={asset.id} className="overflow-hidden rounded-[1.5rem] border border-black/5 bg-neutral-50 dark:border-white/10 dark:bg-neutral-900">
              {asset.mime_type.startsWith("image/") ? (
                asset.signed_url ? (
                  <Image
                    src={asset.signed_url}
                    alt={asset.attachment_name}
                    width={640}
                    height={640}
                    unoptimized
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-neutral-100 text-xs font-semibold text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                    Image unavailable
                  </div>
                )
              ) : asset.mime_type.startsWith("video/") ? (
                <a
                  href={asset.signed_url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex aspect-square items-center justify-center bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/20 text-white">
                    <Play className="ml-0.5 h-5 w-5" />
                  </span>
                </a>
              ) : (
                <div className="flex aspect-square items-center justify-center bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300">
                  <FileText className="h-10 w-10" />
                </div>
              )}

              <div className="space-y-3 p-3">
                <div>
                  <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">{asset.attachment_name}</p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">{formatTimestamp(asset.created_at)}</p>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold">
                  <a href={asset.signed_url ?? "#"} target="_blank" rel="noreferrer" className="text-brand">
                    Preview
                  </a>
                  <a href={asset.signed_url ?? "#"} target="_blank" rel="noreferrer" className="text-neutral-500 dark:text-neutral-300">
                    Download
                  </a>
                  {asset.is_mine ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(asset)}
                      className="text-red-600"
                      disabled={isDeleting === asset.id}
                    >
                      {isDeleting === asset.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="col-span-2 py-16 text-center">
            <p className="text-lg font-bold text-neutral-900 dark:text-neutral-100">No files here yet</p>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Attachments from this conversation will appear here.</p>
          </div>
        )}
      </main>

      <div className="sticky bottom-0 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:bg-neutral-950/95">
        <BottomNav active="cloud" cloudHref={`/files/${conversationId}`} />
      </div>
    </div>
  );
}
