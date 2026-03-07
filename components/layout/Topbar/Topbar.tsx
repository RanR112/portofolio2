"use client";

// components/layout/Topbar/Topbar.tsx
// Step 13: LanguageSwitcher added between status and auth.

import { useActiveSectionContext } from "@/context/ActiveSectionContext";
import { useTranslations } from "next-intl";
import AuthStatus from "@/components/AuthStatus/AuthStatus";
import LanguageSwitcher from "@/components/LanguageSwitcher/LanguageSwitcher";
import styles from "./Topbar.module.scss";

export default function Topbar() {
    const { activeItem } = useActiveSectionContext();
    const t = useTranslations("topbar");

    return (
        <header className={styles.topbar} role="banner">
            <nav className={styles.breadcrumb} aria-label="Section breadcrumb">
                <span className={styles.breadcrumbRoot}>portfolio</span>
                <span className={styles.breadcrumbSeparator} aria-hidden="true">
                    /
                </span>
                <span className={styles.breadcrumbCurrent} aria-current="page">
                    {t(activeItem?.label.toLowerCase() ?? "home")}
                </span>
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
