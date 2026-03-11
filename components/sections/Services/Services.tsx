"use client";

import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import {
    Globe,
    AppWindow,
    Paintbrush,
    Zap,
    Wrench,
    CheckCircle2,
    MapPin,
} from "lucide-react";
import SectionWrapper from "@/components/SectionWrapper/SectionWrapper";
import styles from "./Services.module.scss";

// ── Icon map for each service ────────────────────────────────
const SERVICE_ICONS: Record<string, React.ReactNode> = {
    webDevelopment: <Globe size={22} />,
    webApp: <AppWindow size={22} />,
    redesign: <Paintbrush size={22} />,
    optimization: <Zap size={22} />,
    maintenance: <Wrench size={22} />,
};

const SERVICE_KEYS = [
    "webDevelopment",
    "webApp",
    "redesign",
    "optimization",
    "maintenance",
] as const;

// ── Location links ────────────────────────────────────────────
const LOCATIONS = [
    {
        slug: "website-banjarnegara",
        city: "Banjarnegara",
        region: "Central Java",
    },
    { slug: "website-karawang", city: "Karawang", region: "West Java" },
    { slug: "website-purwokerto", city: "Purwokerto", region: "Central Java" },
    { slug: "website-wonosobo", city: "Wonosobo", region: "Central Java" },
] as const;

// ── Component ────────────────────────────────────────────────
export default function Services() {
    const t = useTranslations("services");
    const locale = useLocale();
    const isId = locale === "id";

    const clientItems = t.raw("clientsGet.items") as Array<{
        title: string;
        description: string;
    }>;

    const processSteps = t.raw("process.steps") as Array<{
        number: string;
        title: string;
        description: string;
    }>;

    const faqItems = t.raw("faq.items") as Array<{
        question: string;
        answer: string;
    }>;

    return (
        <>
            {/* ── HERO ─────────────────────────────────────── */}
            <SectionWrapper
                id="services"
                label={t("label")}
                title={t("title")}
                subtitle={t("subtitle")}
            >
                {/* Overview */}
                <div className={styles.overview}>
                    <p className={styles.overviewText}>
                        {t("overview.description")}
                    </p>
                    <p className={styles.overviewAvailability}>
                        {t("overview.availability")}
                    </p>
                </div>

                {/* ── SERVICE LIST ─────────────────────────────── */}
                <section
                    className={styles.section}
                    aria-labelledby="services-list-heading"
                >
                    <div className={styles.sectionHeader}>
                        <span className={styles.sectionLabel}>
                            {t("list.label")}
                        </span>
                        <h2
                            id="services-list-heading"
                            className={styles.sectionTitle}
                        >
                            {t("list.title")}
                        </h2>
                    </div>

                    <div className={styles.serviceGrid}>
                        {SERVICE_KEYS.map((key) => {
                            const useCases = t.raw(
                                `list.items.${key}.useCases`,
                            ) as string[];
                            return (
                                <article
                                    key={key}
                                    className={styles.serviceCard}
                                >
                                    <div className={styles.serviceCardTop}>
                                        <div className={styles.serviceIcon}>
                                            {SERVICE_ICONS[key]}
                                        </div>
                                        <h3 className={styles.serviceTitle}>
                                            {t(`list.items.${key}.title`)}
                                        </h3>
                                        <p
                                            className={
                                                styles.serviceDescription
                                            }
                                        >
                                            {t(`list.items.${key}.description`)}
                                        </p>
                                    </div>
                                    <ul
                                        className={styles.useCaseList}
                                        aria-label="Use cases"
                                    >
                                        {useCases.map((uc, i) => (
                                            <li
                                                key={i}
                                                className={styles.useCaseItem}
                                            >
                                                <CheckCircle2
                                                    size={13}
                                                    className={
                                                        styles.useCaseIcon
                                                    }
                                                    aria-hidden="true"
                                                />
                                                {uc}
                                            </li>
                                        ))}
                                    </ul>
                                </article>
                            );
                        })}
                    </div>
                </section>

                {/* ── WHAT CLIENTS GET ─────────────────────────── */}
                <section
                    className={styles.section}
                    aria-labelledby="clients-get-heading"
                >
                    <div className={styles.sectionHeader}>
                        <span className={styles.sectionLabel}>
                            {t("clientsGet.label")}
                        </span>
                        <h2
                            id="clients-get-heading"
                            className={styles.sectionTitle}
                        >
                            {t("clientsGet.title")}
                        </h2>
                    </div>

                    <div className={styles.clientsGrid}>
                        {clientItems.map((item, i) => (
                            <div key={i} className={styles.clientsCard}>
                                <h3 className={styles.clientsCardTitle}>
                                    {item.title}
                                </h3>
                                <p className={styles.clientsCardDesc}>
                                    {item.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── WORK PROCESS ─────────────────────────────── */}
                <section
                    className={styles.section}
                    aria-labelledby="process-heading"
                >
                    <div className={styles.sectionHeader}>
                        <span className={styles.sectionLabel}>
                            {t("process.label")}
                        </span>
                        <h2
                            id="process-heading"
                            className={styles.sectionTitle}
                        >
                            {t("process.title")}
                        </h2>
                    </div>

                    <ol
                        className={styles.processList}
                        aria-label={t("process.title")}
                    >
                        {processSteps.map((step, i) => (
                            <li key={i} className={styles.processStep}>
                                <span
                                    className={styles.processNumber}
                                    aria-hidden="true"
                                >
                                    {step.number}
                                </span>
                                <div className={styles.processContent}>
                                    <h3 className={styles.processTitle}>
                                        {step.title}
                                    </h3>
                                    <p className={styles.processDesc}>
                                        {step.description}
                                    </p>
                                </div>
                                {i < processSteps.length - 1 && (
                                    <div
                                        className={styles.processConnector}
                                        aria-hidden="true"
                                    />
                                )}
                            </li>
                        ))}
                    </ol>
                </section>

                {/* ── FAQ ──────────────────────────────────────── */}
                <section
                    className={styles.section}
                    aria-labelledby="faq-heading"
                >
                    <div className={styles.sectionHeader}>
                        <span className={styles.sectionLabel}>
                            {t("faq.label")}
                        </span>
                        <h2 id="faq-heading" className={styles.sectionTitle}>
                            {t("faq.title")}
                        </h2>
                    </div>

                    <dl className={styles.faqList}>
                        {faqItems.map((item, i) => (
                            <div key={i} className={styles.faqItem}>
                                <dt className={styles.faqQuestion}>
                                    {item.question}
                                </dt>
                                <dd className={styles.faqAnswer}>
                                    {item.answer}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </section>

                {/* ── LOCATIONS ────────────────────────────────── */}
                <section
                    className={styles.section}
                    aria-labelledby="locations-heading"
                >
                    <div className={styles.sectionHeader}>
                        <span className={styles.sectionLabel}>
                            {isId ? "Jangkauan" : "Coverage"}
                        </span>
                        <h2
                            id="locations-heading"
                            className={styles.sectionTitle}
                        >
                            {isId
                                ? "Tersedia untuk Proyek di"
                                : "Available for Projects in"}
                        </h2>
                    </div>

                    <div className={styles.locationsGrid}>
                        {LOCATIONS.map((loc) => (
                            <Link
                                key={loc.slug}
                                href={`/${locale}/services/${loc.slug}`}
                                className={styles.locationCard}
                            >
                                <MapPin
                                    size={14}
                                    className={styles.locationPin}
                                    aria-hidden="true"
                                />
                                <span className={styles.locationCity}>
                                    {loc.city}
                                </span>
                                <span className={styles.locationRegion}>
                                    {loc.region}
                                </span>
                            </Link>
                        ))}
                        <div className={styles.locationCardStatic}>
                            <Globe
                                size={14}
                                className={styles.locationPin}
                                aria-hidden="true"
                            />
                            <span className={styles.locationCity}>Remote</span>
                            <span className={styles.locationRegion}>
                                {isId
                                    ? "Seluruh Indonesia & Internasional"
                                    : "Across Indonesia & Worldwide"}
                            </span>
                        </div>
                    </div>
                </section>

                {/* ── CTA ──────────────────────────────────────── */}
                <section
                    className={styles.ctaSection}
                    aria-labelledby="cta-heading"
                >
                    <span className={styles.sectionLabel}>
                        {t("cta.label")}
                    </span>
                    <h2 id="cta-heading" className={styles.ctaTitle}>
                        {t("cta.title")}
                    </h2>
                    <p className={styles.ctaDescription}>
                        {t("cta.description")}
                    </p>
                    <Link
                        href={`/${locale}/contact`}
                        className={styles.ctaButton}
                    >
                        {t("cta.button")}
                    </Link>
                </section>
            </SectionWrapper>
        </>
    );
}
