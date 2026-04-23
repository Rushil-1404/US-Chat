"use client";

import Link from "next/link";
import { Cloud, MessageCircle, Phone, Settings } from "lucide-react";

import { cn } from "@/lib/utils";

type BottomNavProps = {
  active: "chats" | "cloud" | "settings";
  cloudHref?: string;
};

const itemClass =
  "flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors";

export function BottomNav({ active, cloudHref = "/chats" }: BottomNavProps) {
  return (
    <nav className="flex h-16 items-center justify-around border-t border-black/5 bg-white/90 px-2 backdrop-blur">
      <Link href="/chats" className={cn(itemClass, active === "chats" ? "text-brand" : "text-neutral-400")}>
        <MessageCircle className="h-5 w-5" />
        Chats
      </Link>
      <button type="button" className={cn(itemClass, "cursor-not-allowed text-neutral-300")}>
        <Phone className="h-5 w-5" />
        Calls
      </button>
      <Link href={cloudHref} className={cn(itemClass, active === "cloud" ? "text-brand" : "text-neutral-400")}>
        <Cloud className="h-5 w-5" />
        Cloud
      </Link>
      <Link href="/settings" className={cn(itemClass, active === "settings" ? "text-brand" : "text-neutral-400")}>
        <Settings className="h-5 w-5" />
        Settings
      </Link>
    </nav>
  );
}
