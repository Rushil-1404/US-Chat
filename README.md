# US Chat

US Chat is a mobile-first 1-on-1 chat app built with Next.js App Router and Supabase. It replaces the earlier Flask prototype with a single deployment target: Vercel for the app, Supabase for auth, Postgres, realtime, and storage.

## Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS
- Supabase Auth
- Supabase Postgres + Realtime
- Supabase Storage
- Vercel Hobby

## Product Scope

- Google login and email/password login
- First-run onboarding with unique username selection
- Username-based direct chats
- 1-on-1 conversations only
- Realtime messaging with read-state updates
- File attachments for images, videos, PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX
- Shared-files gallery per conversation
- Editable profile and app settings

## Local Setup

1. Create a Supabase project.
2. Copy [`.env.example`](./.env.example) to `.env.local`.
3. Fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

4. Install dependencies:

```bash
npm install
```

5. Start the app:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

## Supabase Setup

### 1. Database migration

Run the SQL from [`supabase/migrations/20260423120000_initial_chat_app.sql`](./supabase/migrations/20260423120000_initial_chat_app.sql) in the Supabase SQL Editor, or apply it with the Supabase CLI if you already use one.

That migration creates:

- `profiles`
- `user_settings`
- `conversations`
- `messages`
- row-level security policies
- storage buckets for `avatars` and `attachments`
- helper RPC functions for chat creation, read updates, and chat-list loading

### 2. Authentication

Enable these auth providers in Supabase:

- Email
- Google

Recommended auth settings:

- Require email confirmation for email/password signups
- Set the site URL to your local or deployed app URL
- Add `/auth/callback` as an allowed redirect path for every environment you use

Examples:

- `http://localhost:3000/auth/callback`
- `https://your-production-domain.vercel.app/auth/callback`

### 3. Google provider

In Google Cloud:

1. Create OAuth credentials
2. Add the Supabase callback URL from the Supabase Google provider screen
3. Paste the Google client ID and secret into Supabase Auth provider settings

## App Flow

1. User signs up with email/password or signs in with Google
2. Supabase Auth manages credentials and sessions
3. New users are redirected to `/onboarding`
4. User picks a unique username and optional avatar
5. Chats can then be created by entering another user's username

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm test
```

## Vercel Deployment

1. Import this repository into Vercel
2. Add these environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

3. Deploy
4. Add your Vercel production URL to Supabase Auth settings
5. Add the production callback URL:

```text
https://your-domain/auth/callback
```

6. If you use Google login, make sure the corresponding redirect and authorized origin values are also configured in Google Cloud

## Docker

You can package the app as a container with Docker.

Important:

- the app's `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are used in client-side code
- that means they must be available at image build time, not only at container runtime

### Build the image

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  -t us-chat .
```

PowerShell single-line version:

```powershell
docker build --build-arg NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key -t us-chat .
```

### Run the container

```bash
docker run --rm -p 3000:3000 us-chat
```

Then open [http://localhost:3000](http://localhost:3000)

### Rebuild when env values change

If you switch Supabase projects or change the public key, rebuild the image so the client bundle picks up the new values.

## Project Structure

- [`src/app`](./src/app): App Router pages and auth callback route
- [`src/components`](./src/components): auth, chats, shared-files, settings, layout UI
- [`src/lib`](./src/lib): validation, Supabase helpers, server auth, shared utilities
- [`supabase/migrations`](./supabase/migrations): SQL schema, RLS, RPCs, and storage policies

## Notes

- This repo now targets Vercel + Supabase only; the old Flask/OTP/Render stack has been removed.
- Supabase free projects can pause after inactivity, so this is a strong hobby deployment path, not an uptime-guaranteed enterprise setup.
- Username is intentionally immutable in v1. Display name, avatar, status, and settings remain editable.
