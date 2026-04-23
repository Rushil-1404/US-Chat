import type { Metadata } from "next";
import { Manrope } from "next/font/google";

import { APP_NAME } from "@/lib/constants";
import { getCurrentUser, getUserSettings } from "@/lib/auth/server";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: "A minimalist one-to-one chat app powered by Vercel and Supabase.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  const settings = user ? await getUserSettings(user.id) : null;
  const theme = settings?.theme ?? "light";

  return (
    <html lang="en" data-theme={theme} className={manrope.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
