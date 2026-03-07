"use client";

// components/PianoSidebar/PianoSidebar.tsx
//
// Step 10: Multi-page navigation.
//   - next/link replaces scroll behaviour
//   - Active key driven by usePathname (via ActiveSectionContext)
//   - White keys only — black key variant removed
//   - Solfège shortcut labels (Do Re Mi…) replace numeric shortcuts
//   - Mobile hamburger retained from Step 9

import { useCallback, useState, useRef, useEffect, memo } from "react";
import Link from "next/link";
import { useNavItems, type NavItem } from "@/lib/navItems";
import { usePianoAudio } from "@/hooks/usePianoAudio";
import { useActiveSectionContext } from "@/context/ActiveSectionContext";
import styles from "./PianoSidebar.module.scss";
import { Logo } from "@/assets/index.assets";
import Image from "next/image";
import { useLocale } from "next-intl";

// ---- PianoKey — memoized ----

type PianoKeyProps = {
    item: NavItem;
    isActive: boolean;
    isPressed: boolean;
    isFocused: boolean;
    tabIndex: number;
    onPlay: (id: string, note: string) => void;
    onFocus: (index: number) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLAnchorElement>) => void;
    keyIndex: number;
};

const PianoKey = memo(function PianoKey({
    item,
    isActive,
    isPressed,
    isFocused,
    tabIndex,
    onPlay,
    onFocus,
    onKeyDown,
    keyIndex,
}: PianoKeyProps) {
    const locale = useLocale();
    return (
        <li role="listitem">
            <Link
                href={`/${locale}${item.route === "/" ? "" : item.route}`}
                className={[
                    styles.key,
                    isActive ? styles.keyActive : "",
                    isPressed ? styles.keyPressed : "",
                ]
                    .filter(Boolean)
                    .join(" ")}
                onClick={() => onPlay(item.id, item.note)}
                onFocus={() => onFocus(keyIndex)}
                onKeyDown={onKeyDown}
                tabIndex={tabIndex}
                aria-label={`Navigate to ${item.label}`}
                aria-current={isActive ? "page" : undefined}
                prefetch={true}
            >
                <span className={styles.keyNotch} aria-hidden="true" />
                <span className={styles.keyIcon} aria-hidden="true">
                    {item.icon}
                </span>
                <span className={styles.keyShortcut} aria-hidden="true">
                    {item.shortcut}
                </span>
                <span className={styles.keyTooltip} role="tooltip">
                    {item.label}
                </span>
            </Link>
        </li>
    );
});

// ---- Sidebar ----

export default function PianoSidebar() {
    const { playNote } = usePianoAudio();
    const { activeId } = useActiveSectionContext();

    const [pressedId, setPressedId] = useState<string | null>(null);
    const [focusedIndex, setFocusedIndex] = useState<number>(0);
    const [mobileOpen, setMobileOpen] = useState(false);

    const navItems = useNavItems();
    const navRef = useRef<HTMLElement>(null);

    // Lock body scroll when mobile sidebar is open
    useEffect(() => {
        if (mobileOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [mobileOpen]);

    // ESC closes mobile sidebar
    useEffect(() => {
        if (!mobileOpen) return;
        const handle = (e: KeyboardEvent) => {
            if (e.key === "Escape") setMobileOpen(false);
        };
        document.addEventListener("keydown", handle);
        return () => document.removeEventListener("keydown", handle);
    }, [mobileOpen]);

    // Close sidebar on navigation (pathname change handled by Link)
    const handlePlay = useCallback(
        (id: string, note: string) => {
            playNote(note);
            setPressedId(id);
            setTimeout(() => setPressedId(null), 180);
            setMobileOpen(false); // close on mobile after tap
        },
        [playNote],
    );

    const handleFocus = useCallback((index: number) => {
        setFocusedIndex(index);
    }, []);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLAnchorElement>) => {
            const total = navItems.length;
            let nextIndex: number | null = null;

            switch (e.key) {
                case "ArrowDown":
                case "ArrowRight":
                    e.preventDefault();
                    nextIndex = (focusedIndex + 1) % total;
                    break;
                case "ArrowUp":
                case "ArrowLeft":
                    e.preventDefault();
                    nextIndex = (focusedIndex - 1 + total) % total;
                    break;
                case "Home":
                    e.preventDefault();
                    nextIndex = 0;
                    break;
                case "End":
                    e.preventDefault();
                    nextIndex = total - 1;
                    break;
            }

            if (nextIndex !== null) {
                setFocusedIndex(nextIndex);
                const links =
                    navRef.current?.querySelectorAll<HTMLAnchorElement>("a");
                links?.[nextIndex]?.focus();
            }
        },
        [focusedIndex, navItems],
    );

    return (
        <>
            {/* Mobile hamburger */}
            <button
                className={`${styles.hamburger} ${
                    mobileOpen ? styles.open : ""
                }`}
                onClick={() => setMobileOpen((v) => !v)}
                aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
                aria-expanded={mobileOpen}
                aria-controls="piano-sidebar"
            >
                {mobileOpen ? <CloseIcon /> : <HamburgerIcon />}
            </button>

            {/* Mobile backdrop */}
            {mobileOpen && (
                <div
                    className={styles.mobileBackdrop}
                    onClick={() => setMobileOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar */}
            <aside
                id="piano-sidebar"
                className={[
                    styles.sidebar,
                    mobileOpen ? styles.sidebarOpen : "",
                ]
                    .filter(Boolean)
                    .join(" ")}
                aria-label="Main navigation"
            >
                {/* Logo */}
                <div className={styles.logo}>
                    <Image
                        src={Logo}
                        alt="Logo Website"
                        width={40}
                        height={40}
                    />
                    <span className="sr-only">Randy Rafael — Portfolio</span>
                </div>

                {/* Piano key navigation */}
                <nav
                    ref={navRef}
                    className={styles.nav}
                    aria-label="Section navigation"
                >
                    <ul role="list" className={styles.keyList}>
                        {navItems.map((item, index) => (
                            <PianoKey
                                key={item.id}
                                item={item}
                                isActive={activeId === item.id}
                                isPressed={pressedId === item.id}
                                isFocused={focusedIndex === index}
                                tabIndex={focusedIndex === index ? 0 : -1}
                                onPlay={handlePlay}
                                onFocus={handleFocus}
                                onKeyDown={handleKeyDown}
                                keyIndex={index}
                            />
                        ))}
                    </ul>
                </nav>

                {/* Bottom controls */}
                {/* <div className={styles.bottom}>
                    <ThemeToggle />
                </div> */}
            </aside>
        </>
    );
}

// ---- Icons ----

function HamburgerIcon() {
    return (
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            aria-hidden="true"
            focusable="false"
        >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
    );
}

function CloseIcon() {
    return (
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            aria-hidden="true"
            focusable="false"
        >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    );
}
