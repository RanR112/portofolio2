"use client";
//
// Two-column layout on desktop: bio text left, info cards right.
// Collapses to single column on mobile.
// No images yet — text-only, strong typographic hierarchy.

import SectionWrapper from "@/components/SectionWrapper/SectionWrapper";
import styles from "./About.module.scss";
import { useTranslations } from "next-intl";

// --- Types ---
type InfoItem = {
    key: string;
    value: string;
    isAccent?: boolean; // highlights status-style values (e.g. "Open to work")
};

// --- Static data ---
const INFO_ITEMS: InfoItem[] = [
    { key: "infoCard.location", value: "infoCard.locationValue" },
    { key: "infoCard.role", value: "infoCard.roleValue" },
    { key: "infoCard.stack", value: "infoCard.stackValue" },
    { key: "infoCard.available", value: "infoCard.availableValue" },
    { key: "infoCard.focus", value: "infoCard.focusValue" },
    { key: "infoCard.education", value: "infoCard.educationValue" },
    { key: "infoCard.status", value: "infoCard.statusValue", isAccent: true },
];

const BIO_PARAGRAPHS: string[] = ["bio1", "bio2", "bio3", "bio4", "bio5"];

export default function About() {
    const t = useTranslations("about");
    return (
        <SectionWrapper id="about" label={t("label")} title={t("title")}>
            <div className={styles.layout}>
                {/* Left column — biography */}
                <div className={styles.bioColumn}>
                    {BIO_PARAGRAPHS.map((paragraph, index) => (
                        <p key={index} className={styles.bioParagraph}>
                            {t(paragraph)}
                        </p>
                    ))}
                </div>

                {/* Right column — info cards */}
                <aside
                    className={styles.infoColumn}
                    aria-label="Personal information"
                >
                    <div className={styles.infoCard}>
                        <h3 className={styles.infoCardTitle}>
                            {t("infoCard.title")}
                        </h3>

                        <dl className={styles.infoList}>
                            {INFO_ITEMS.map((item) => (
                                <div key={item.key} className={styles.infoItem}>
                                    <dt className={styles.infoKey}>
                                        {t(item.key)}
                                    </dt>
                                    <dd
                                        className={[
                                            styles.infoValue,
                                            item.isAccent
                                                ? styles.infoValueAccent
                                                : "",
                                        ]
                                            .filter(Boolean)
                                            .join(" ")}
                                    >
                                        {item.isAccent && (
                                            <span
                                                className={styles.statusDot}
                                                aria-hidden="true"
                                            />
                                        )}
                                        {t(item.value)}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                </aside>
            </div>
        </SectionWrapper>
    );
}
