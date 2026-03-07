// lib/comments.ts
//
// Type definitions and data-access functions for the comments table.
// All Supabase interaction for comments lives here — CommentUI
// imports these functions and never touches supabaseClient directly.
//
// Table schema (create in Supabase SQL editor):
//
//   create table public.comments (
//     id         uuid primary key default gen_random_uuid(),
//     user_id    uuid references auth.users(id) on delete cascade not null,
//     name       text not null,
//     avatar_url text,
//     message    text not null check (char_length(message) between 1 and 1000),
//     created_at timestamptz default now() not null
//   );
//
// Row Level Security policies:
//
//   alter table public.comments enable row level security;
//
//   -- Anyone can read
//   create policy "comments_select_all"
//     on public.comments for select using (true);
//
//   -- Only authenticated users can insert their own row
//   create policy "comments_insert_own"
//     on public.comments for insert
//     with check (auth.uid() = user_id);
//
//   -- Only the owner can delete their own row
//   create policy "comments_delete_own"
//     on public.comments for delete
//     using (auth.uid() = user_id);

import { supabase } from "@/lib/supabaseClient";

// ============================================================
// Types
// ============================================================

// Mirrors the database row exactly
export type DbComment = {
    id: string;
    user_id: string;
    name: string;
    avatar_url: string | null;
    message: string;
    created_at: string;
};

// UI-enriched comment — adds derived fields used only in components
export type Comment = DbComment & {
    initials: string; // derived from name for avatar fallback
    avatarBg: string; // CSS colour string from deterministic palette
    avatarFg: string; // CSS colour string
    isOwn: boolean; // true if current user owns this comment
};

// ============================================================
// Avatar colour palette
// Deterministic per-user: hash user_id to an index so the
// same user always gets the same colour across sessions.
// ============================================================

const AVATAR_BG: string[] = [
    "rgba(201, 168, 108, 0.18)", // amber
    "rgba(100, 160, 200, 0.18)", // blue
    "rgba(140, 200, 160, 0.18)", // green
    "rgba(200, 130, 160, 0.18)", // rose
];

const AVATAR_FG: string[] = ["#c9a86c", "#64a0c8", "#8cc8a0", "#c882a0"];

function hashIndex(str: string, length: number): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    return hash % length;
}

function deriveInitials(name: string): string {
    return name
        .split(" ")
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() ?? "")
        .join("");
}

// Enriches a raw DbComment into the UI Comment shape
export function enrichComment(row: DbComment, currentUserId?: string): Comment {
    const idx = hashIndex(row.user_id, AVATAR_BG.length);
    return {
        ...row,
        initials: deriveInitials(row.name),
        avatarBg: AVATAR_BG[idx],
        avatarFg: AVATAR_FG[idx],
        isOwn: !!currentUserId && currentUserId === row.user_id,
    };
}

// ============================================================
// Data access functions
// ============================================================

export type FetchCommentsResult =
    | { data: DbComment[]; error: null }
    | { data: null; error: string };

export async function fetchComments(): Promise<FetchCommentsResult> {
    const { data, error } = await supabase
        .from("comments")
        .select("id, user_id, name, avatar_url, message, created_at")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("[fetchComments]", error.message);
        return { data: null, error: error.message };
    }

    return { data: data as DbComment[], error: null };
}

// ============================================================

export type InsertCommentPayload = {
    user_id: string;
    name: string;
    avatar_url: string | null;
    message: string;
};

export type InsertCommentResult =
    | { data: DbComment; error: null }
    | { data: null; error: string };

export async function insertComment(
    payload: InsertCommentPayload,
): Promise<InsertCommentResult> {
    const { data, error } = await supabase
        .from("comments")
        .insert(payload)
        .select("id, user_id, name, avatar_url, message, created_at")
        .single();

    if (error) {
        console.error("[insertComment]", error.message);
        return { data: null, error: error.message };
    }

    return { data: data as DbComment, error: null };
}

// ============================================================

export type DeleteCommentResult = { error: null } | { error: string };

export async function deleteComment(id: string): Promise<DeleteCommentResult> {
    const { error } = await supabase.from("comments").delete().eq("id", id);

    if (error) {
        console.error("[deleteComment]", error.message);
        return { error: error.message };
    }

    return { error: null };
}
