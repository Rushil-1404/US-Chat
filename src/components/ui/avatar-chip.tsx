import Image from "next/image";

import { cn, initialsFromName } from "@/lib/utils";

type AvatarChipProps = {
  src?: string | null;
  name?: string | null;
  className?: string;
  fallbackClassName?: string;
};

export function AvatarChip({ src, name, className, fallbackClassName }: AvatarChipProps) {
  if (src) {
    return (
      <div className={cn("relative overflow-hidden rounded-full bg-brand/10 dark:bg-brand/20", className)}>
        <Image src={src} alt={name ?? "Avatar"} fill className="object-cover" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-brand/15 font-bold text-brand dark:bg-brand/20",
        className,
        fallbackClassName,
      )}
    >
      {initialsFromName(name)}
    </div>
  );
}
