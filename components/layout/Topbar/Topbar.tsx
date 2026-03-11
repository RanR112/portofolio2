"use client";

// components/layout/Topbar/Topbar.tsx
// Step 13: LanguageSwitcher added between status and auth.

import { useActiveSectionContext } from "@/context/ActiveSectionContext";
import { useLocale, useTranslations } from "next-intl";
import AuthStatus from "@/components/AuthStatus/AuthStatus";
import LanguageSwitcher from "@/components/LanguageSwitcher/LanguageSwitcher";
import { useParams } from "next/navigation";
import styles from "./Topbar.module.scss";
import Link from "next/link";

function formatSlug(slug: string) {
    return slug
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

export default function Topbar() {
    const { activeItem } = useActiveSectionContext();
    const params = useParams();
    const t = useTranslations("topbar");
    const locale = useLocale();

    const slug = params?.slug as string | undefined;

    const currentLabel = slug
        ? "services"
        : (activeItem?.label.toLowerCase() ?? "home");

    return (
        <header className={styles.topbar} role="banner">
            <nav className={styles.breadcrumb} aria-label="Section breadcrumb">
                <span className={styles.breadcrumbRoot}>portfolio</span>
                <span className={styles.breadcrumbSeparator} aria-hidden="true">
                    /
                </span>
                <Link
                    href={`/${locale}/${currentLabel}`}
                    className={slug ? styles.breadcrumbRoot : styles.breadcrumbCurrent}
                    aria-current="page"
                >
                    {t(currentLabel)}
                </Link>
                {slug && (
                    <>
                        <span
                            className={styles.breadcrumbSeparator}
                            aria-hidden="true"
                        >
                            /
                        </span>

                        <span
                            className={styles.breadcrumbCurrent}
                            aria-current="page"
                        >
                            {formatSlug(slug)}
                        </span>
                    </>
                )}
            </nav>

            <div className={styles.right}>
                <div className={styles.status} role="status">
                    <span className={styles.statusDot} aria-hidden="true" />
                    <span className={styles.statusText}>{t("available")}</span>
                </div>

                <span className={styles.divider} aria-hidden="true" />
                <LanguageSwitcher />
                <span className={styles.divider} aria-hidden="true" />
                <AuthStatus />
            </div>
        </header>
    );
}
