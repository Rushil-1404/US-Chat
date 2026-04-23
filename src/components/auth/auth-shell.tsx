import type { ReactNode } from "react";

import { MessageCircle } from "lucide-react";

import { APP_NAME } from "@/lib/constants";

type AuthShellProps = {
  title: string;
  description: string;
  footer?: ReactNode;
  children: ReactNode;
};

export function AuthShell({ title, description, footer, children }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(37,211,102,0.14),_transparent_30%),linear-gradient(180deg,#f6f2ea_0%,#fbfaf7_42%,#ffffff_100%)] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-brand text-white shadow-float">
            <MessageCircle className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand/80">{APP_NAME}</p>
            <h1 className="text-3xl font-extrabold tracking-tight text-neutral-950">{title}</h1>
            <p className="mx-auto max-w-sm text-sm leading-6 text-neutral-500">{description}</p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-black/5 bg-white/90 p-6 shadow-float backdrop-blur">
          {children}
        </div>

        {footer ? <div className="mt-6 text-center text-sm text-neutral-500">{footer}</div> : null}
      </div>
    </div>
  );
}
