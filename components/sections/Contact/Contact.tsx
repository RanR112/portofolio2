"use client";

// components/sections/Contact/Contact.tsx
//
// Contact section — fully wired backend (Step 8).
//
// What changed from Step 7 (UI-only):
//   - Added 'use client' directive
//   - Form state: name, email, message (controlled inputs)
//   - Submission state machine: idle → loading → success | error
//   - handleSubmit sends POST to /api/contact
//   - fieldset no longer permanently disabled — disabled only while loading
//   - Submit button reflects current state (idle / loading / success / error)
//   - Success and error feedback rendered inline below the form
//   - ConstructionIcon replaced with SendIcon and state-appropriate icons
//
// Layout, styling, left column, link list, availability note —
// all unchanged from Step 7.

import { useState, useCallback, useRef } from "react";
import SectionWrapper from "@/components/SectionWrapper/SectionWrapper";
import styles from "./Contact.module.scss";
import { useTranslations } from "next-intl";

// ============================================================
// Types
// ============================================================

type FormStatus = "idle" | "loading" | "success" | "error";

type FormState = {
    name: string;
    email: string;
    message: string;
};

// ============================================================
// Contact link data — unchanged from Step 7
// ============================================================

type ContactLink = {
    id: string;
    label: string;
    value: string;
    href: string;
    icon: React.ReactNode;
};

const CONTACT_LINKS: ContactLink[] = [
    {
        id: "email",
        label: "Email",
        value: "randyrafael112@gmail.com",
        href: "mailto:randyrafael112@gmail.com",
        icon: <EmailIcon />,
    },
    {
        id: "github",
        label: "GitHub",
        value: "RanR112",
        href: "https://github.com/RanR112",
        icon: <GitHubIcon />,
    },
    {
        id: "linkedin",
        label: "LinkedIn",
        value: "Randy Rafael",
        href: "https://www.linkedin.com/in/randyrafael112/",
        icon: <LinkedInIcon />,
    },
    {
        id: "instagram",
        label: "Instagram",
        value: "randyrafael112",
        href: "https://instagram.com/randyrafael112",
        icon: <InstagramIcon />,
    },
];

// ============================================================
// Component
// ============================================================

export default function Contact() {
    const [form, setForm] = useState<FormState>({
        name: "",
        email: "",
        message: "",
    });
    const [status, setStatus] = useState<FormStatus>("idle");
    const [feedback, setFeedback] = useState<string>("");

    const t = useTranslations("contact");

    // Focus the feedback region after submission for screen readers
    const feedbackRef = useRef<HTMLDivElement>(null);

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const { id, value } = e.target;
            // Map input ids to field names: 'contact-name' → 'name'
            const field = id.replace("contact-", "") as keyof FormState;
            setForm((prev) => ({ ...prev, [field]: value }));
            // Clear any previous error when the user starts editing
            if (status === "error") setStatus("idle");
        },
        [status],
    );

    const handleSubmit = useCallback(async () => {
        if (status === "loading" || status === "success") return;

        setStatus("loading");
        setFeedback("");

        try {
            const res = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.name.trim(),
                    email: form.email.trim(),
                    message: form.message.trim(),
                }),
            });

            const data: { success: boolean; message: string } =
                await res.json();

            if (data.success) {
                setStatus("success");
                setFeedback(data.message);
                setForm({ name: "", email: "", message: "" });
            } else {
                setStatus("error");
                setFeedback(data.message);
            }
        } catch {
            setStatus("error");
            setFeedback("Network error. Check your connection and try again.");
        }

        // Move focus to feedback for screen readers
        setTimeout(() => feedbackRef.current?.focus(), 50);
    }, [status, form]);

    const isLoading = status === "loading";
    const isSuccess = status === "success";
    // Disable fields while loading or after successful send (no double-send)
    const isDisabled = isLoading || isSuccess;

    return (
        <SectionWrapper
            id="contact"
            label={t("label")}
            title={t("title")}
            subtitle={t("subtitle")}
        >
            <div className={styles.layout}>
                {/* ---- Left column: contact info — unchanged ---- */}
                <div className={styles.infoColumn}>
                    <p className={styles.infoIntro}>
                        {t("text")}
                    </p>

                    <ul
                        className={styles.linkList}
                        aria-label="Contact channels"
                    >
                        {CONTACT_LINKS.map((link) => (
                            <li key={link.id}>
                                <a
                                    href={link.href}
                                    className={styles.contactLink}
                                    target={
                                        link.id !== "email"
                                            ? "_blank"
                                            : undefined
                                    }
                                    rel={
                                        link.id !== "email"
                                            ? "noopener noreferrer"
                                            : undefined
                                    }
                                    aria-label={`${link.label}: ${link.value}`}
                                >
                                    <span
                                        className={styles.contactLinkIcon}
                                        aria-hidden="true"
                                    >
                                        {link.icon}
                                    </span>
                                    <div className={styles.contactLinkBody}>
                                        <span
                                            className={styles.contactLinkLabel}
                                        >
                                            {link.label}
                                        </span>
                                        <span
                                            className={styles.contactLinkValue}
                                        >
                                            {link.value}
                                        </span>
                                    </div>
                                    <span
                                        className={styles.contactLinkArrow}
                                        aria-hidden="true"
                                    >
                                        <ArrowIcon />
                                    </span>
                                </a>
                            </li>
                        ))}
                    </ul>

                    <div className={styles.availabilityNote}>
                        <span
                            className={styles.availabilityDot}
                            aria-hidden="true"
                        />
                        <p className={styles.availabilityText}>
                            {t("availability")}
                        </p>
                    </div>
                </div>

                {/* ---- Right column: live contact form ---- */}
                <div className={styles.formColumn}>
                    <div className={styles.formCard} aria-label="Contact form">
                        <div className={styles.formHeader}>
                            <p className={styles.formTitle}>{t("form.title")}</p>
                            <p className={styles.formSubtitle}>
                                {t("form.subtitle")}
                            </p>
                        </div>

                        {/* Feedback region — success or error, announced to screen readers */}
                        {feedback && (
                            <div
                                ref={feedbackRef}
                                className={[
                                    styles.feedback,
                                    isSuccess
                                        ? styles.feedbackSuccess
                                        : styles.feedbackError,
                                ].join(" ")}
                                role="status"
                                aria-live="polite"
                                aria-atomic="true"
                                tabIndex={-1}
                            >
                                {isSuccess ? <CheckIcon /> : <ErrorIcon />}
                                <p className={styles.feedbackText}>
                                    {feedback}
                                </p>
                            </div>
                        )}

                        <fieldset
                            className={styles.fieldset}
                            disabled={isDisabled}
                        >
                            <legend className="sr-only">
                                Contact form fields
                            </legend>

                            <div className={styles.fieldRow}>
                                <div className={styles.field}>
                                    <label
                                        htmlFor="contact-name"
                                        className={styles.fieldLabel}
                                    >
                                        {t("form.name")}
                                    </label>
                                    <input
                                        id="contact-name"
                                        type="text"
                                        className={styles.input}
                                        placeholder={t("form.namePlaceholder")}
                                        autoComplete="name"
                                        value={form.name}
                                        onChange={handleChange}
                                        maxLength={100}
                                    />
                                </div>

                                <div className={styles.field}>
                                    <label
                                        htmlFor="contact-email"
                                        className={styles.fieldLabel}
                                    >
                                        {t("form.email")}
                                    </label>
                                    <input
                                        id="contact-email"
                                        type="email"
                                        className={styles.input}
                                        placeholder={t("form.emailPlaceholder")}
                                        autoComplete="email"
                                        value={form.email}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            <div className={styles.field}>
                                <label
                                    htmlFor="contact-message"
                                    className={styles.fieldLabel}
                                >
                                    {t("form.message")}
                                </label>
                                <textarea
                                    id="contact-message"
                                    className={styles.textarea}
                                    rows={5}
                                    placeholder={t("form.messagePlaceholder")}
                                    value={form.message}
                                    onChange={handleChange}
                                    maxLength={5000}
                                />
                            </div>

                            <button
                                className={[
                                    styles.submitButton,
                                    isLoading ? styles.submitButtonLoading : "",
                                    isSuccess ? styles.submitButtonSuccess : "",
                                ]
                                    .filter(Boolean)
                                    .join(" ")}
                                type="button"
                                onClick={handleSubmit}
                                disabled={isDisabled}
                                aria-disabled={isDisabled}
                                aria-label={
                                    isLoading
                                        ? t("form.sending")
                                        : isSuccess
                                          ? t("form.successTitle")
                                          : t("form.submit")
                                }
                            >
                                {isLoading ? (
                                    <>
                                        <Spinner />
                                        {t("form.sending")}
                                    </>
                                ) : isSuccess ? (
                                    <>
                                        <CheckIcon />
                                        {t("form.successTitle")}
                                    </>
                                ) : (
                                    <>
                                        <SendIcon />
                                        {t("form.submit")}
                                    </>
                                )}
                            </button>
                        </fieldset>
                    </div>
                </div>
            </div>
        </SectionWrapper>
    );
}

// ============================================================
// Inline SVG icons — unchanged set + new icons for button states
// ============================================================

function EmailIcon() {
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
            focusable="false"
        >
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
        </svg>
    );
}

function GitHubIcon() {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
        >
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
        </svg>
    );
}

function LinkedInIcon() {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
        >
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
    );
}

function InstagramIcon() {
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
            focusable="false"
        >
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="18" cy="6" r="1.5" />
        </svg>
    );
}

function ArrowIcon() {
    return (
        <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <line x1="7" y1="17" x2="17" y2="7" />
            <polyline points="7 7 17 7 17 17" />
        </svg>
    );
}

function SendIcon() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
    );
}

function CheckIcon() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}

function ErrorIcon() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
    );
}

function Spinner() {
    return <span className={styles.spinner} aria-hidden="true" />;
}
