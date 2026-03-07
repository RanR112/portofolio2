-- supabase/migrations/001_create_comments.sql
--
-- Run this in: Supabase Dashboard → SQL Editor
-- Or via Supabase CLI: supabase db push
--
-- Creates the comments table and configures Row Level Security
-- so that read is public, insert requires auth, and delete is
-- owner-only. All enforced at the database level — not just the client.
-- ============================================================
-- Table
-- ============================================================
create table
    if not exists public.comments (
        id uuid primary key default gen_random_uuid (),
        user_id uuid not null references auth.users (id) on delete cascade,
        name text not null,
        avatar_url text,
        message text not null,
        created_at timestamptz not null default now (),
        -- Prevent empty or excessively long messages
        constraint message_length check (char_length(message) between 1 and 1000),
        -- Prevent empty names
        constraint name_not_empty check (char_length(trim(name)) > 0)
    );

-- Index for the default sort order (DESC) — avoids a sequential scan
create index if not exists comments_created_at_desc on public.comments (created_at desc);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.comments enable row level security;

-- Anyone (including unauthenticated) can read all comments
create policy "comments_select_all" on public.comments for
select
    using (true);

-- Only an authenticated user can insert a comment,
-- and only as themselves (user_id must match their JWT sub)
create policy "comments_insert_own" on public.comments for insert
with
    check (auth.uid () = user_id);

-- Only the comment owner can delete their own comment
create policy "comments_delete_own" on public.comments for delete using (auth.uid () = user_id);

-- ============================================================
-- Realtime
-- ============================================================
-- Enable realtime for this table so the client subscription
-- (supabase.channel().on('postgres_changes')) receives events.
-- Run in Supabase Dashboard → Database → Replication if not set.
--
-- alter publication supabase_realtime add table public.comments;
--
-- (Uncomment and run separately if realtime is not already enabled)