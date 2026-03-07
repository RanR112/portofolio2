"use client";

// components/sections/PrivacyPolicy/PrivacyPolicy.tsx

import { useTranslations } from "next-intl";
import SectionWrapper from "@/components/SectionWrapper/SectionWrapper";
import styles from "./PrivacyPolicy.module.scss";

export default function PrivacyPolicy() {
    const t = useTranslations("privacy");

    const sections = [
        {
            key: "dataCollected",
            titleKey: "sections.dataCollected",
            bodyKey: "sections.dataCollectedContent",
        },
        {
            key: "oauthUsage",
            titleKey: "sections.oauthUsage",
            bodyKey: "sections.oauthContent",
        },
        {
            key: "supabase",
            titleKey: "sections.supabase",
            bodyKey: "sections.supabaseContent",
        },
        {
            key: "emailUsage",
            titleKey: "sections.emailUsage",
            bodyKey: "sections.emailContent",
        },
        {
            key: "retention",
            titleKey: "sections.retention",
            bodyKey: "sections.retentionContent",
        },
        {
            key: "rights",
            titleKey: "sections.rights",
            bodyKey: "sections.rightsContent",
        },
        {
            key: "security",
            titleKey: "sections.security",
            bodyKey: "sections.securityContent",
        },
    ] as const;

    return (
        <SectionWrapper
            id="privacy"
            label={t("label")}
            title={t("title")}
            subtitle={t("subtitle")}
        >
            <div className={styles.content}>
                <p className={styles.intro}>{t("intro")}</p>

                {sections.map(({ key, titleKey, bodyKey }) => (
                    <section key={key} className={styles.section}>
                        <h3 className={styles.sectionTitle}>{t(titleKey)}</h3>
                        <p className={styles.sectionBody}>{t(bodyKey)}</p>
                    </section>
                ))}

                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>
                        {t("sections.contact")}
                    </h3>
                    <p className={styles.sectionBody}>
                        {t("sections.contactContent")}
                    </p>
                    <a
                        href="mailto:randyrafael112@gmail.com"
                        className={styles.contactEmail}
                    >
                        randyrafael112@gmail.com
                    </a>
                </section>
            </div>
        </SectionWrapper>
    );
}
