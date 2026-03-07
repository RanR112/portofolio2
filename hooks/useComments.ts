"use client";

// hooks/useComments.ts
//
// Manages all comment state for CommentUI:
//   - Initial fetch on mount
//   - Realtime subscription via Supabase postgres_changes
//   - Insert (post new comment)
//   - Delete (owner only — enforced by RLS + UI guard)
//
// Why a dedicated hook and not inline in CommentUI:
//   CommentUI is already responsible for layout and rendering.
//   Mixing data-fetching concerns into it would make both harder
//   to read and test. The hook owns state, the component owns UI.
//
// Realtime strategy:
//   Subscribe to INSERT and DELETE events on the comments table.
//   On INSERT — prepend the new row to local state (newest-first order).
//   On DELETE — remove the matching id from local state.
//   This avoids a full re-fetch on every change.

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
    fetchComments,
    insertComment,
    deleteComment,
    enrichComment,
    type Comment,
    type DbComment,
} from "@/lib/comments";

type UseCommentsReturn = {
    comments: Comment[];
    isLoading: boolean;
    fetchError: string | null;
    submitError: string | null;
    isSubmitting: boolean;
    postComment: (message: string) => Promise<boolean>; // returns true on success
    removeComment: (id: string) => Promise<void>;
    clearSubmitError: () => void;
};

export function useComments(currentUserId?: string): UseCommentsReturn {
    const [comments, setComments] = useState<Comment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Ref to always have the latest currentUserId inside the realtime callback
    // without re-subscribing every time the user changes
    const currentUserIdRef = useRef(currentUserId);
    useEffect(() => {
        currentUserIdRef.current = currentUserId;
    }, [currentUserId]);

    // ---- Initial fetch ----
    useEffect(() => {
        let cancelled = false;

        async function load() {
            setIsLoading(true);
            setFetchError(null);

            const result = await fetchComments();

            if (cancelled) return;

            if (result.error) {
                setFetchError(result.error);
                setIsLoading(false);
                return;
            }

            setComments(
                result.data.map((row) =>
                    enrichComment(row, currentUserIdRef.current),
                ),
            );
            setIsLoading(false);
        }

        load();
        return () => {
            cancelled = true;
        };
    }, []); // runs once on mount — realtime handles subsequent updates

    // Re-enrich when currentUserId changes (login/logout)
    // so isOwn flags update without a full re-fetch
    useEffect(() => {
        setComments((prev) => prev.map((c) => enrichComment(c, currentUserId)));
    }, [currentUserId]);

    // ---- Realtime subscription ----
    useEffect(() => {
        const channel = supabase
            .channel("comments-realtime")
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "comments",
                },
                (payload) => {
                    const newRow = payload.new as DbComment;
                    setComments((prev) => {
                        // Guard against duplicate delivery (Supabase can occasionally
                        // fire a realtime event for a row we inserted ourselves and
                        // already prepended optimistically)
                        if (prev.some((c) => c.id === newRow.id)) return prev;
                        return [
                            enrichComment(newRow, currentUserIdRef.current),
                            ...prev,
                        ];
                    });
                },
            )
            .on(
                "postgres_changes",
                {
                    event: "DELETE",
                    schema: "public",
                    table: "comments",
                },
                (payload) => {
                    const deletedId = (payload.old as Partial<DbComment>).id;
                    if (deletedId) {
                        setComments((prev) =>
                            prev.filter((c) => c.id !== deletedId),
                        );
                    }
                },
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []); // subscribe once — ref keeps userId current

    // ---- Post a comment ----
    const postComment = useCallback(
        async (message: string): Promise<boolean> => {
            if (!currentUserIdRef.current) return false;

            const trimmed = message.trim();
            if (!trimmed) return false;

            setIsSubmitting(true);
            setSubmitError(null);

            // Resolve display name and avatar from the current session
            const {
                data: { session },
            } = await supabase.auth.getSession();
            const meta = session?.user?.user_metadata ?? {};
            const name =
                meta.full_name ??
                meta.name ??
                session?.user?.email?.split("@")[0] ??
                "Anonymous";
            const avatar_url = meta.avatar_url ?? meta.picture ?? null;

            const result = await insertComment({
                user_id: currentUserIdRef.current,
                name,
                avatar_url,
                message: trimmed,
            });

            setIsSubmitting(false);

            if (result.error) {
                setSubmitError(result.error);
                return false;
            }

            // Realtime will handle prepending the new comment to state.
            // No manual state update needed here.
            return true;
        },
        [],
    );

    // ---- Delete a comment ----
    const removeComment = useCallback(async (id: string): Promise<void> => {
        // Optimistic removal — remove from UI immediately
        setComments((prev) => prev.filter((c) => c.id !== id));

        const result = await deleteComment(id);

        if (result.error) {
            // Re-fetch to restore the comment if delete failed
            const refetch = await fetchComments();
            if (!refetch.error) {
                setComments(
                    refetch.data.map((row) =>
                        enrichComment(row, currentUserIdRef.current),
                    ),
                );
            }
        }
        // On success, realtime DELETE event will also fire but the guard
        // in the subscription handles the duplicate gracefully
    }, []);

    const clearSubmitError = useCallback(() => setSubmitError(null), []);

    return {
        comments,
        isLoading,
        fetchError,
        submitError,
        isSubmitting,
        postComment,
        removeComment,
        clearSubmitError,
    };
}
