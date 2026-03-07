"use client";

// components/sections/CommentUI/CommentUI.tsx
//
// Live comment section backed by Supabase.
// Auth state drives the form: logged-in users can post and delete
// their own comments; guests see login buttons instead.
//
// Data flow:
//   useComments()  — fetch, realtime, insert, delete
//   useAuth()      — current user session
//
// This component is purely presentational relative to data —
// all Supabase calls are inside the hook.

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import SectionWrapper from "@/components/SectionWrapper/SectionWrapper";
import AuthButtons from "@/components/AuthButtons/AuthButtons";
import { useAuth } from "@/context/AuthContext";
import { useComments } from "@/hooks/useComments";
import type { Comment } from "@/lib/comments";
import styles from "./CommentUI.module.scss";

const MAX_LENGTH = 1000;

export default function CommentUI() {
    const { user } = useAuth();
    const t = useTranslations("comments");
    const locale = useLocale();
    const {
        comments,
        isLoading,
        fetchError,
        submitError,
        isSubmitting,
        postComment,
        removeComment,
        clearSubmitError,
    } = useComments(user?.id);

    const [message, setMessage] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const charsLeft = MAX_LENGTH - message.length;

    // Clear submit error when user starts typing again
    useEffect(() => {
        if (submitError && message) clearSubmitError();
    }, [message, submitError, clearSubmitError]);

    const meta = user?.user_metadata ?? {};
    const avatarUrl: string | undefined =
        meta.avatar_url ?? meta.picture ?? undefined;
    const displayName: string =
        meta.full_name ?? meta.name ?? user?.email?.split("@")[0] ?? "User";

    const handleSubmit = async () => {
        if (!message.trim() || isSubmitting) return;
        const success = await postComment(message);
        if (success) {
            setMessage("");
            textareaRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Cmd/Ctrl + Enter to submit
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <SectionWrapper
            id="comments"
            label={t("label")}
            title={t("title")}
            subtitle={t("subtitle")}
        >
            <div className={styles.layout}>
                {/* ---- Comment form ---- */}
                <div className={styles.formCard} aria-label="Comment form">
                    {user ? (
                        /* Authenticated — show live form */
                        <>
                            <div className={styles.formUser}>
                                <div
                                    className={styles.avatar}
                                    aria-hidden="true"
                                >
                                    {avatarUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={avatarUrl}
                                            alt={displayName}
                                            className={styles.avatarImage}
                                            referrerPolicy="no-referrer"
                                        />
                                    ) : (
                                        <span className={styles.avatarInitials}>
                                            <AuthorAvatar
                                                name={
                                                    user.user_metadata
                                                        ?.full_name ??
                                                    user.user_metadata?.name ??
                                                    "You"
                                                }
                                            />
                                        </span>
                                    )}
                                </div>
                                <span className={styles.formUserName}>
                                    {t("as")}{" "}
                                    <strong>
                                        {user.user_metadata?.full_name ??
                                            user.user_metadata?.name ??
                                            user.email}
                                    </strong>
                                </span>
                            </div>

                            <div className={styles.field}>
                                <label
                                    htmlFor="comment-input"
                                    className={styles.fieldLabel}
                                >
                                    {t("your")}
                                </label>
                                <textarea
                                    id="comment-input"
                                    ref={textareaRef}
                                    className={[
                                        styles.textarea,
                                        submitError ? styles.textareaError : "",
                                    ]
                                        .filter(Boolean)
                                        .join(" ")}
                                    rows={4}
                                    placeholder={t("placeholder")}
                                    value={message}
                                    onChange={(e) =>
                                        setMessage(
                                            e.target.value.slice(0, MAX_LENGTH),
                                        )
                                    }
                                    onKeyDown={handleKeyDown}
                                    disabled={isSubmitting}
                                    aria-describedby={
                                        submitError
                                            ? "submit-error"
                                            : "comment-hint"
                                    }
                                    aria-invalid={!!submitError}
                                />

                                <div className={styles.fieldMeta}>
                                    {submitError ? (
                                        <span
                                            id="submit-error"
                                            className={styles.fieldError}
                                            role="alert"
                                        >
                                            <ErrorIcon />
                                            {submitError}
                                        </span>
                                    ) : (
                                        <span
                                            id="comment-hint"
                                            className={styles.fieldHint}
                                        >
                                            {t("hint")}
                                        </span>
                                    )}
                                    <span
                                        className={[
                                            styles.charCount,
                                            charsLeft < 100
                                                ? styles.charCountWarn
                                                : "",
                                        ]
                                            .filter(Boolean)
                                            .join(" ")}
                                        aria-live="polite"
                                        aria-label={`${charsLeft} characters remaining`}
                                    >
                                        {charsLeft}
                                    </span>
                                </div>
                            </div>

                            <button
                                className={styles.submitButton}
                                onClick={handleSubmit}
                                disabled={isSubmitting || !message.trim()}
                                aria-label={t("submit")}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Spinner />
                                        {t("posting")}
                                    </>
                                ) : (
                                    t("submit")
                                )}
                            </button>

                            <p className={styles.disclaimer}>
                                {t("privacy-auth")}{" "}
                                <Link href={`/${locale}/privacy-policy`}>
                                    {t("privacyLink")}
                                </Link>
                                .
                            </p>
                        </>
                    ) : (
                        /* Guest — show auth prompt */
                        <div className={styles.authGate}>
                            <div className={styles.authGateText}>
                                <LockIcon />
                                <div>
                                    <p className={styles.authGateTitle}>
                                        {t("loginTitle")}
                                    </p>
                                    <p className={styles.authGateHint}>
                                        {t("loginHint")}
                                    </p>
                                </div>
                            </div>
                            <AuthButtons layout="column" />
                            <p className={styles.disclaimer}>
                                {t("privacy-guest")}{" "}
                                <Link
                                    href={`/${locale}/privacy-policy`}
                                    className={styles.privacyLink}
                                >
                                    {t("privacyLink")}
                                </Link>
                                .
                            </p>
                        </div>
                    )}
                </div>

                {/* ---- Comment list ---- */}
                <div className={styles.commentList} aria-label="Comments">
                    {/* List heading */}
                    <h3 className={styles.listHeading}>
                        {isLoading
                            ? t("loading")
                            : fetchError
                              ? t("error")
                              : `${comments.length} ${comments.length !== 1 ? t("count_other") : t("count_one")}`}
                    </h3>

                    {/* Error state */}
                    {fetchError && !isLoading && (
                        <div className={styles.fetchError} role="alert">
                            <ErrorIcon />
                            <p>{fetchError}</p>
                        </div>
                    )}

                    {/* Loading skeletons */}
                    {isLoading && (
                        <ul
                            className={styles.list}
                            aria-busy="true"
                            aria-label={t("loading")}
                        >
                            {Array.from({ length: 3 }).map((_, i) => (
                                <li
                                    key={i}
                                    className={styles.skeleton}
                                    aria-hidden="true"
                                >
                                    <span className={styles.skeletonAvatar} />
                                    <div className={styles.skeletonBody}>
                                        <span
                                            className={styles.skeletonLine}
                                            style={{ width: "35%" }}
                                        />
                                        <span
                                            className={styles.skeletonLine}
                                            style={{ width: "90%" }}
                                        />
                                        <span
                                            className={styles.skeletonLine}
                                            style={{ width: "70%" }}
                                        />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}

                    {/* Empty state */}
                    {!isLoading && !fetchError && comments.length === 0 && (
                        <p className={styles.emptyState}>
                            {t("noComment")}
                        </p>
                    )}

                    {/* Populated list */}
                    {!isLoading && comments.length > 0 && (
                        <ul className={styles.list}>
                            {comments.map((comment) => (
                                <CommentItem
                                    key={comment.id}
                                    comment={comment}
                                    onDelete={removeComment}
                                />
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </SectionWrapper>
    );
}

// ============================================================
// CommentItem
// ============================================================

type CommentItemProps = {
    comment: Comment;
    onDelete: (id: string) => Promise<void>;
};

function CommentItem({ comment, onDelete }: CommentItemProps) {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        setIsDeleting(true);
        await onDelete(comment.id);
        // Component may unmount after optimistic removal — no need to reset
    };

    return (
        <li
            className={[
                styles.commentItem,
                isDeleting ? styles.commentItemDeleting : "",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {/* Avatar */}
            <div
                className={styles.avatar}
                style={
                    {
                        backgroundColor: comment.avatarBg,
                        color: comment.avatarFg,
                    } as React.CSSProperties
                }
                aria-hidden="true"
            >
                {comment.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={comment.avatar_url}
                        alt={comment.name}
                        className={styles.avatarImage}
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    comment.initials
                )}
            </div>

            {/* Body */}
            <div className={styles.commentBody}>
                <div className={styles.commentHeader}>
                    <span className={styles.commentAuthor}>{comment.name}</span>

                    <div className={styles.commentActions}>
                        <time
                            className={styles.commentDate}
                            dateTime={comment.created_at}
                        >
                            {formatDate(comment.created_at)}
                        </time>

                        {comment.isOwn && (
                            <button
                                className={styles.deleteButton}
                                onClick={handleDelete}
                                disabled={isDeleting}
                                aria-label="Delete your comment"
                                title="Delete comment"
                            >
                                {isDeleting ? (
                                    <Spinner size={11} />
                                ) : (
                                    <TrashIcon />
                                )}
                            </button>
                        )}
                    </div>
                </div>

                <p className={styles.commentMessage}>{comment.message}</p>
            </div>
        </li>
    );
}

// ============================================================
// AuthorAvatar — small avatar for the "commenting as" row
// ============================================================

function AuthorAvatar({ name }: { name: string }) {
    const initials = name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("");

    return (
        <span className={styles.formUserAvatar} aria-hidden="true">
            {initials}
        </span>
    );
}

// ============================================================
// Utilities
// ============================================================

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

// ============================================================
// Inline icons
// ============================================================

function LockIcon() {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
        >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
    );
}

function TrashIcon() {
    return (
        <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
    );
}

function ErrorIcon() {
    return (
        <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
        >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
    );
}

function Spinner({ size = 13 }: { size?: number }) {
    return (
        <span
            className={styles.spinner}
            style={{ width: size, height: size } as React.CSSProperties}
            aria-hidden="true"
        />
    );
}
