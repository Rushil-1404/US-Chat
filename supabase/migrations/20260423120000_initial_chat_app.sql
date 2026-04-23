create extension if not exists pgcrypto;
create extension if not exists citext;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username citext not null unique,
  display_name text not null,
  avatar_path text,
  status_text text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_username_format check (username::text ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_display_name_length check (char_length(trim(display_name)) between 2 and 40)
);

create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  theme text not null default 'light',
  notifications_enabled boolean not null default true,
  read_receipts_enabled boolean not null default true,
  last_seen_visibility text not null default 'everyone',
  media_auto_download text not null default 'wifi_only',
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_settings_theme check (theme in ('light', 'dark')),
  constraint user_settings_last_seen check (last_seen_visibility in ('everyone', 'matches', 'nobody')),
  constraint user_settings_media_auto check (media_auto_download in ('always', 'wifi_only', 'never'))
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  participant_key text generated always as (
    least(user_a::text, user_b::text) || ':' || greatest(user_a::text, user_b::text)
  ) stored,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint conversations_no_self_chat check (user_a <> user_b),
  constraint conversations_unique_pair unique (participant_key)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  message_type text not null,
  text_body text,
  attachment_path text,
  attachment_name text,
  mime_type text,
  size_bytes bigint,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint messages_type_check check (message_type in ('text', 'image', 'video', 'document'))
);

create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at desc);
create index if not exists messages_sender_idx on public.messages (sender_id);

create or replace function public.touch_conversation()
returns trigger
language plpgsql
as $$
begin
  update public.conversations
  set updated_at = timezone('utc', now())
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at
before update on public.user_settings
for each row
execute function public.set_updated_at();

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
before update on public.conversations
for each row
execute function public.set_updated_at();

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
after insert on public.messages
for each row
execute function public.touch_conversation();

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "authenticated users can read searchable profiles"
on public.profiles
for select
to authenticated
using (true);

create policy "users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "users can read their own settings"
on public.user_settings
for select
to authenticated
using (auth.uid() = user_id);

create policy "users can insert their own settings"
on public.user_settings
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users can update their own settings"
on public.user_settings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "conversation members can read conversations"
on public.conversations
for select
to authenticated
using (auth.uid() in (user_a, user_b));

create policy "conversation members can read messages"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.conversations conversation
    where conversation.id = conversation_id
      and auth.uid() in (conversation.user_a, conversation.user_b)
  )
);

create policy "members can insert their own messages"
on public.messages
for insert
to authenticated
with check (
  auth.uid() = sender_id
  and exists (
    select 1
    from public.conversations conversation
    where conversation.id = conversation_id
      and auth.uid() in (conversation.user_a, conversation.user_b)
  )
);

create policy "recipients can mark messages as read"
on public.messages
for update
to authenticated
using (
  sender_id <> auth.uid()
  and exists (
    select 1
    from public.conversations conversation
    where conversation.id = conversation_id
      and auth.uid() in (conversation.user_a, conversation.user_b)
  )
)
with check (
  sender_id <> auth.uid()
  and exists (
    select 1
    from public.conversations conversation
    where conversation.id = conversation_id
      and auth.uid() in (conversation.user_a, conversation.user_b)
  )
);

create policy "senders can replace their attachment with a stub"
on public.messages
for update
to authenticated
using (sender_id = auth.uid())
with check (sender_id = auth.uid());

create or replace function public.find_or_create_direct_conversation(target_username text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_user_id uuid;
  conversation_id uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select id
  into target_user_id
  from public.profiles
  where username = target_username::citext
  limit 1;

  if target_user_id is null then
    raise exception 'User not found';
  end if;

  if target_user_id = current_user_id then
    raise exception 'Cannot create a chat with yourself';
  end if;

  insert into public.conversations (user_a, user_b)
  values (current_user_id, target_user_id)
  on conflict (participant_key) do nothing;

  select id
  into conversation_id
  from public.conversations
  where participant_key = least(current_user_id::text, target_user_id::text) || ':' || greatest(current_user_id::text, target_user_id::text)
  limit 1;

  return conversation_id;
end;
$$;

grant execute on function public.find_or_create_direct_conversation(text) to authenticated;

create or replace function public.mark_conversation_read(target_conversation_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  updated_count integer;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.conversations conversation
    where conversation.id = target_conversation_id
      and current_user_id in (conversation.user_a, conversation.user_b)
  ) then
    raise exception 'Conversation not found';
  end if;

  update public.messages
  set read_at = timezone('utc', now())
  where conversation_id = target_conversation_id
    and sender_id <> current_user_id
    and read_at is null;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

grant execute on function public.mark_conversation_read(uuid) to authenticated;

create or replace function public.get_chat_list()
returns table (
  conversation_id uuid,
  conversation_updated_at timestamptz,
  partner_id uuid,
  partner_username text,
  partner_display_name text,
  partner_avatar_path text,
  partner_status_text text,
  latest_message_id uuid,
  latest_message_text text,
  latest_message_type text,
  latest_attachment_name text,
  latest_created_at timestamptz,
  unread_count bigint
)
language sql
security definer
set search_path = public
as $$
  with my_conversations as (
    select
      conversation.id,
      conversation.updated_at,
      case when conversation.user_a = auth.uid() then conversation.user_b else conversation.user_a end as partner_id
    from public.conversations conversation
    where auth.uid() in (conversation.user_a, conversation.user_b)
  ),
  latest_messages as (
    select distinct on (message.conversation_id)
      message.conversation_id,
      message.id as latest_message_id,
      message.text_body,
      message.message_type,
      message.attachment_name,
      message.created_at
    from public.messages message
    order by message.conversation_id, message.created_at desc
  ),
  unread_messages as (
    select
      message.conversation_id,
      count(*) as unread_count
    from public.messages message
    where message.sender_id <> auth.uid()
      and message.read_at is null
    group by message.conversation_id
  )
  select
    conversation.id as conversation_id,
    conversation.updated_at as conversation_updated_at,
    profile.id as partner_id,
    profile.username::text as partner_username,
    profile.display_name as partner_display_name,
    profile.avatar_path as partner_avatar_path,
    profile.status_text as partner_status_text,
    latest.latest_message_id,
    latest.text_body as latest_message_text,
    latest.message_type as latest_message_type,
    latest.attachment_name as latest_attachment_name,
    latest.created_at as latest_created_at,
    coalesce(unread.unread_count, 0) as unread_count
  from my_conversations my
  join public.conversations conversation on conversation.id = my.id
  join public.profiles profile on profile.id = my.partner_id
  left join latest_messages latest on latest.conversation_id = conversation.id
  left join unread_messages unread on unread.conversation_id = conversation.id
  order by greatest(coalesce(latest.created_at, conversation.updated_at), conversation.updated_at) desc;
$$;

grant execute on function public.get_chat_list() to authenticated;

alter table public.messages replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy "public avatars are readable"
on storage.objects
for select
to public
using (bucket_id = 'avatars');

create policy "users can upload their own avatars"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users can update their own avatars"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users can delete their own avatars"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "conversation members can read attachments"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'attachments'
  and exists (
    select 1
    from public.conversations conversation
    where conversation.id = ((storage.foldername(name))[1])::uuid
      and auth.uid() in (conversation.user_a, conversation.user_b)
  )
);

create policy "conversation members can upload attachments"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'attachments'
  and exists (
    select 1
    from public.conversations conversation
    where conversation.id = ((storage.foldername(name))[1])::uuid
      and auth.uid() in (conversation.user_a, conversation.user_b)
  )
);

create policy "senders can delete their own attachments"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'attachments'
  and exists (
    select 1
    from public.messages message
    where message.attachment_path = name
      and message.sender_id = auth.uid()
  )
);
