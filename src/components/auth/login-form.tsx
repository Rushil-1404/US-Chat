"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { signInSchema } from "@/lib/validators";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = signInSchema.safeParse({ email, password });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Unable to sign in.");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword(parsed.data);
    setIsSubmitting(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    startTransition(() => {
      router.replace("/");
      router.refresh();
    });
  }

  async function handleGoogleSignIn() {
    setError(null);
    setIsGoogleLoading(true);

    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setIsGoogleLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isGoogleLoading}
        className="flex h-12 w-full items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50 font-semibold text-neutral-800 transition hover:bg-neutral-100 disabled:opacity-60"
      >
        {isGoogleLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Continue with Google"}
      </button>

      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.26em] text-neutral-300">
        <div className="h-px flex-1 bg-neutral-100" />
        Or
        <div className="h-px flex-1 bg-neutral-100" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-neutral-700">Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm outline-none transition focus:border-brand focus:bg-white"
            placeholder="hello@yourchat.app"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-neutral-700">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm outline-none transition focus:border-brand focus:bg-white"
            placeholder="••••••••"
          />
        </label>

        {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand font-semibold text-white shadow-float transition hover:brightness-95 disabled:opacity-60"
        >
          {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          Sign In
        </button>
      </form>

      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="font-medium text-brand transition hover:text-emerald-600">
          Forgot password?
        </Link>
        <Link href="/signup" className="font-medium text-neutral-500 transition hover:text-neutral-800">
          Create account
        </Link>
      </div>
    </div>
  );
}
