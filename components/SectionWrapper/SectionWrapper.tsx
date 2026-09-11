// components/SectionWrapper/SectionWrapper.tsx
//
// Generic layout wrapper applied to every content section.
//
// Wrapped in React.memo: label, title, subtitle are static strings
// passed from static section components. Without memo, every context
// update (e.g. scroll-spy activeId change) would cause all 8 section
// headers to re-render even though nothing about them changed.
//
// Note: children are included in memo's shallow comparison.
// Sections with dynamic children (e.g. Projects) will still re-render
// when their children change — memo correctly lets that through.

import { memo, type ReactNode } from "react";
import dynamic from "next/dynamic";
import styles from "./SectionWrapper.module.scss";
// [BARU — kinetic-console, Step 2] Code-split lewat next/dynamic (pola yang
// sama seperti ProjectDetailModal di Projects.tsx) — SectionWrapper dipakai
// di SEMUA halaman, tapi KineticText (dan `motion` di baliknya) cuma benar-
// benar dirender di Dashboard (size="hero"). Import statis biasa akan
// membocorkan bundle `motion` ke 7 halaman lain yang tidak pernah
// menampilkannya — perform-aware per prinsip di CLAUDE.md.
// ssr TIDAK dimatikan (default true): fallback plain-text di KineticText
// tetap ter-render di server, jadi nama pemilik situs tetap ada di HTML
// awal untuk SEO/no-JS; hanya JS animasinya yang lazy-load di client.
const KineticText = dynamic(
    () => import("@/components/ui/KineticText/KineticText"),
);

type SectionWrapperProps = {
    id: string;
    label: string;
    title: string;
    subtitle?: string;
    children: ReactNode;
    fullWidth?: boolean;
    // [BARU — kinetic-console, Step 2] Opsional, default "default" — semua
    // pemanggil yang sudah ada (About, Stack, Projects, Services, Timeline,
    // Contact) tidak berubah sama sekali. Hanya Dashboard yang memakai
    // size="hero" untuk mendapat skala besar + animasi per-karakter,
    // supaya perubahan hero tidak "bocor" ke section header halaman lain
    // sebelum step-nya masing-masing.
    size?: "default" | "hero";
};

const SectionWrapper = memo(function SectionWrapper({
    id,
    label,
    title,
    subtitle,
    children,
    fullWidth = false,
    size = "default",
}: SectionWrapperProps) {
    return (
        <section
            id={`section-${id}`}
            className={styles.section}
            aria-labelledby={`heading-${id}`}
        >
            <div
                className={fullWidth ? styles.containerFull : styles.container}
            >
                <header className={styles.header}>
                    <span className={styles.label} aria-hidden="true">
                        {label}
                    </span>

                    {/* [LAMA — pre kinetic-console]
                    <h2 id={`heading-${id}`} className={styles.title}>
                        {title}
                    </h2>
                    */}
                    {/* [BARU — kinetic-console, Step 2] */}
                    <h2
                        id={`heading-${id}`}
                        className={[
                            styles.title,
                            size === "hero" ? styles.titleHero : "",
                        ]
                            .filter(Boolean)
                            .join(" ")}
                    >
                        {size === "hero" ? (
                            <KineticText text={title} />
                        ) : (
                            title
                        )}
                    </h2>

                    {subtitle && <p className={styles.subtitle}>{subtitle}</p>}

                    <hr className={styles.divider} aria-hidden="true" />
                </header>

                <div className={styles.body}>{children}</div>
            </div>
        </section>
    );
});

export default SectionWrapper;
