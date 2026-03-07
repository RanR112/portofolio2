"use client";

// components/LanguageSwitcher/LanguageSwitcher.tsx
//
// Minimal EN / ID toggle in the Topbar.
// Clicking switches locale while preserving the current page path.
//
// Mechanism:
//   - usePathname() gives the full path e.g. /en/about
//   - We replace the locale segment: /en/about → /id/about
//   - next/link handles the navigation — no JS redirect needed
//   - next-intl middleware reads the new path and serves the correct messages
//   - The middleware also sets a NEXT_LOCALE cookie so the preference persists

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { locales } from "@/i18n/routing";
import styles from "./LanguageSwitcher.module.scss";

export default function LanguageSwitcher() {
    const pathname = usePathname();
    const locale = useLocale();

    // Build the alternate locale href by swapping the locale segment
    function getAltHref(targetLocale: string): string {
        // pathname starts with /{currentLocale}
        const prefix = `/${locale}`;
        const rest = pathname.startsWith(prefix)
            ? pathname.slice(prefix.length) || "/"
            : pathname;
        return `/${targetLocale}${rest === "/" ? "" : rest}`;
    }

    return (
        <div
            className={styles.switcher}
            role="navigation"
            aria-label="Language switcher"
        >
            {locales.map((loc, i) => (
                <span key={loc} className={styles.item}>
                    {loc === locale ? (
                        <span
                            className={[styles.label, styles.labelActive].join(
                                " ",
                            )}
                            aria-current="true"
                            aria-label={`Current language: ${loc.toUpperCase()}`}
                        >
                            {loc.toUpperCase()}
                        </span>
                    ) : (
                        <Link
                            href={getAltHref(loc)}
                            className={styles.label}
                            aria-label={`Switch to ${loc === "en" ? "English" : "Indonesian"}`}
                            prefetch={false}
                        >
                            {loc.toUpperCase()}
                        </Link>
                    )}
                    {i < locales.length - 1 && (
                        <span className={styles.sep} aria-hidden="true">
                            /
                        </span>
                    )}
                </span>
            ))}
        </div>
    );
}
