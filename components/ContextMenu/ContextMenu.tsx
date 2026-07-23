"use client";

// components/ContextMenu/ContextMenu.tsx
//
// Global custom right-click menu, mounted once in the locale layout so it is
// active on every path.
//
// Behaviour:
//   - Polite override: the native browser menu still appears when the user has
//     selected text or holds Shift while right-clicking (so Copy / Inspect /
//     Open-in-new-tab stay reachable).
//   - On /piano the context menu is suppressed entirely — native AND custom —
//     because that page is a focused, keyboard-driven fullscreen experience.
//   - Portal to <body>, clamped to the viewport, dismissed on Escape, scroll,
//     resize, outside click, or route change. Arrow keys move between items.
//   - Desktop only: touch long-press is left alone.

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useActiveSectionContext } from "@/context/ActiveSectionContext";
import {
    ArrowUp,
    FolderGit2,
    Home,
    Languages,
    Link2,
    Phone,
} from "lucide-react";
import styles from "./ContextMenu.module.scss";

type Pos = { x: number; y: number };

type Action = {
    group: number;
    icon: ReactNode;
    label: string;
    run: () => void;
};

const VIEWPORT_PAD = 8;

export default function ContextMenu() {
    const pathname = usePathname();
    const router = useRouter();
    const locale = useLocale();
    const t = useTranslations("contextMenu");
    const navT = useTranslations("nav");
    const { activeItem } = useActiveSectionContext();

    const [mounted, setMounted] = useState(false);
    const [pos, setPos] = useState<Pos | null>(null); // raw click anchor
    const [coords, setCoords] = useState<Pos | null>(null); // viewport-clamped
    const [ready, setReady] = useState(false);
    const [copied, setCopied] = useState(false);

    const menuRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const focusIdx = useRef(0);

    const isPiano = pathname.includes("/piano");

    useEffect(() => setMounted(true), []);

    const close = useCallback(() => {
        setPos(null);
        setCoords(null);
        setReady(false);
        setCopied(false);
    }, []);

    // ── Open on right-click (with polite native fallback + /piano suppression) ──
    useEffect(() => {
        const onContextMenu = (e: MouseEvent) => {
            if (isPiano) {
                // No context menu at all on the piano page.
                e.preventDefault();
                return;
            }
            // Defer to the native menu when text is selected or Shift is held.
            const selection = window.getSelection?.()?.toString().trim();
            if (e.shiftKey || (selection && selection.length > 0)) return;

            e.preventDefault();
            focusIdx.current = 0;
            setCopied(false);
            setReady(false);
            setPos({ x: e.clientX, y: e.clientY });
        };
        document.addEventListener("contextmenu", onContextMenu);
        return () => document.removeEventListener("contextmenu", onContextMenu);
    }, [isPiano]);

    // Close on navigation.
    useEffect(() => {
        close();
    }, [pathname, close]);

    // ── Actions ────────────────────────────────────────────────────────────
    const go = useCallback(
        (path: string) => {
            router.push(path);
            close();
        },
        [router, close],
    );

    const altLangHref = useCallback(() => {
        const prefix = `/${locale}`;
        const rest = pathname.startsWith(prefix)
            ? pathname.slice(prefix.length) || "/"
            : pathname;
        const target = locale === "en" ? "id" : "en";
        return `/${target}${rest === "/" ? "" : rest}`;
    }, [locale, pathname]);

    const copyLink = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            window.setTimeout(close, 900);
        } catch {
            close();
        }
    }, [close]);

    const backToTop = useCallback(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        close();
    }, [close]);

    const actions: Action[] = [
        {
            group: 0,
            icon: <Home size={15} />,
            label: t("home"),
            run: () => go(`/${locale}`),
        },
        {
            group: 0,
            icon: <FolderGit2 size={15} />,
            label: t("projects"),
            run: () => go(`/${locale}/projects`),
        },
        {
            group: 0,
            icon: <Phone size={15} />,
            label: t("contact"),
            run: () => go(`/${locale}/contact`),
        },
        {
            group: 1,
            icon: <Link2 size={15} />,
            label: copied ? t("copied") : t("copyLink"),
            run: copyLink,
        },
        {
            group: 1,
            icon: <Languages size={15} />,
            label: t("switchLanguage"),
            run: () => go(altLangHref()),
        },
        {
            group: 1,
            icon: <ArrowUp size={15} />,
            label: t("backToTop"),
            run: backToTop,
        },
    ];

    // ── Dismiss + keyboard navigation while open ───────────────────────────
    useEffect(() => {
        if (!pos) return;

        const onScroll = () => close();
        const onResize = () => close();
        const onPointerDown = (e: PointerEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                close();
            }
        };
        const onKeyDown = (e: KeyboardEvent) => {
            const items = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
            if (items.length === 0) return;

            if (e.key === "Escape") {
                e.preventDefault();
                close();
            } else if (e.key === "ArrowDown") {
                e.preventDefault();
                focusIdx.current = (focusIdx.current + 1) % items.length;
                items[focusIdx.current]?.focus();
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                focusIdx.current =
                    (focusIdx.current - 1 + items.length) % items.length;
                items[focusIdx.current]?.focus();
            } else if (e.key === "Home") {
                e.preventDefault();
                focusIdx.current = 0;
                items[0]?.focus();
            } else if (e.key === "End") {
                e.preventDefault();
                focusIdx.current = items.length - 1;
                items[focusIdx.current]?.focus();
            }
        };

        window.addEventListener("scroll", onScroll, true);
        window.addEventListener("resize", onResize);
        document.addEventListener("pointerdown", onPointerDown, true);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("scroll", onScroll, true);
            window.removeEventListener("resize", onResize);
            document.removeEventListener("pointerdown", onPointerDown, true);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [pos, close]);

    // ── Clamp to viewport, then reveal + focus the first item ──────────────
    useEffect(() => {
        if (!pos || !menuRef.current) return;
        const el = menuRef.current;
        const rect = el.getBoundingClientRect();

        let x = pos.x;
        let y = pos.y;
        if (x + rect.width + VIEWPORT_PAD > window.innerWidth) {
            x = window.innerWidth - rect.width - VIEWPORT_PAD;
        }
        if (y + rect.height + VIEWPORT_PAD > window.innerHeight) {
            y = window.innerHeight - rect.height - VIEWPORT_PAD;
        }
        x = Math.max(VIEWPORT_PAD, x);
        y = Math.max(VIEWPORT_PAD, y);

        setCoords({ x, y });
        setReady(true);
        itemRefs.current[0]?.focus();
    }, [pos]);

    if (!mounted || !pos) return null;

    const sectionLabel = navT(`label.${activeItem?.label ?? "dashboard"}`);
    const point = coords ?? pos;

    return createPortal(
        <div
            ref={menuRef}
            className={styles.menu}
            style={{
                left: point.x,
                top: point.y,
                visibility: ready ? "visible" : "hidden",
            }}
            role="menu"
            aria-label={t("aria")}
        >
            <div className={styles.header}>
                <span>portfolio</span>
                <span className={styles.headerSep} aria-hidden="true">
                    /
                </span>
                <span className={styles.headerSection}>{sectionLabel}</span>
            </div>

            {actions.map((a, i) => {
                const prev = actions[i - 1];
                const divider = prev && prev.group !== a.group;
                return (
                    <div key={a.label + i} className={styles.row}>
                        {divider && (
                            <div className={styles.divider} aria-hidden="true" />
                        )}
                        <button
                            ref={(el) => {
                                itemRefs.current[i] = el;
                            }}
                            className={styles.item}
                            role="menuitem"
                            tabIndex={i === 0 ? 0 : -1}
                            onClick={a.run}
                            onMouseEnter={() => (focusIdx.current = i)}
                        >
                            <span className={styles.icon} aria-hidden="true">
                                {a.icon}
                            </span>
                            <span className={styles.label}>{a.label}</span>
                        </button>
                    </div>
                );
            })}
        </div>,
        document.body,
    );
}
