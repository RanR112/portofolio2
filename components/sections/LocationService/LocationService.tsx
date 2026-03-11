// components/sections/LocationService/LocationService.tsx
//
// Renders a location-specific service page.
// Receives pre-resolved data and locale — no i18n hooks needed
// since content is already locale-specific in locationServices.ts.
"use client";

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
import type { LocationData } from "@/lib/locationServices";
import styles from "./LocationService.module.scss";

// ── Service definitions ───────────────────────────────────────
// Reuse service labels + icons, descriptions adapted per locale

type ServiceItem = {
    key: string;
    icon: React.ReactNode;
    en: { title: string; description: string };
    id: { title: string; description: string };
};

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL;

const SERVICES: ServiceItem[] = [
    {
        key: "webDevelopment",
        icon: <Globe size={20} />,
        en: {
            title: "Website Development",
            description:
                "Building websites from scratch. Start from company profiles, portfolios, landing pages, with clean structure and mobile-friendly layouts.",
        },
        id: {
            title: "Pengembangan Website",
            description:
                "Membangun website dari awal. Mulai dari profil perusahaan, portofolio, landing page, dengan struktur bersih dan tampilan mobile-friendly.",
        },
    },
    {
        key: "webApp",
        icon: <AppWindow size={20} />,
        en: {
            title: "Custom Web Applications",
            description:
                "Web applications with specific business logic, such as dashboards, booking systems, ordering pages, or internal tools.",
        },
        id: {
            title: "Aplikasi Web Kustom",
            description:
                "Aplikasi web dengan logika bisnis tertentu, seperti dashboard, sistem pemesanan, halaman order, atau alat internal.",
        },
    },
    {
        key: "redesign",
        icon: <Paintbrush size={20} />,
        en: {
            title: "Website Redesign",
            description:
                "Rebuilding an existing website with better structure, updated design, and improved performance.",
        },
        id: {
            title: "Redesain Website",
            description:
                "Membangun ulang website yang ada dengan struktur lebih baik, desain diperbarui, dan performa ditingkatkan.",
        },
    },
    {
        key: "optimization",
        icon: <Zap size={20} />,
        en: {
            title: "Website Optimization",
            description:
                "Faster load times, better Lighthouse scores, and smoother user experience for existing websites.",
        },
        id: {
            title: "Optimasi Website",
            description:
                "Waktu muat lebih cepat, skor Lighthouse lebih baik, dan pengalaman pengguna lebih lancar untuk website yang sudah ada.",
        },
    },
    {
        key: "maintenance",
        icon: <Wrench size={20} />,
        en: {
            title: "Website Maintenance",
            description:
                "Ongoing support. content updates, bug fixes, dependency upgrades, and general upkeep.",
        },
        id: {
            title: "Pemeliharaan Website",
            description:
                "Dukungan berkelanjutan. pembaruan konten, perbaikan bug, pembaruan dependensi, dan perawatan umum.",
        },
    },
];

// ── Process steps ─────────────────────────────────────────────
const PROCESS = {
    en: [
        {
            number: "01",
            title: "Discovery",
            description: "We discuss scope, requirements, and timeline.",
        },
        {
            number: "02",
            title: "Planning",
            description:
                "Technical approach, page structure, and feature scope.",
        },
        {
            number: "03",
            title: "Development",
            description: "The main build phase with milestone updates.",
        },
        {
            number: "04",
            title: "Review & Launch",
            description: "Final review, feedback, and deployment.",
        },
    ],
    id: [
        {
            number: "01",
            title: "Diskusi Awal",
            description:
                "Kita membahas ruang lingkup, kebutuhan, dan timeline.",
        },
        {
            number: "02",
            title: "Perencanaan",
            description:
                "Pendekatan teknis, struktur halaman, dan ruang lingkup fitur.",
        },
        {
            number: "03",
            title: "Pengembangan",
            description:
                "Fase pembangunan utama dengan update di titik-titik penting.",
        },
        {
            number: "04",
            title: "Review & Peluncuran",
            description: "Tinjauan akhir, masukan, dan deployment.",
        },
    ],
};

// ── Props ─────────────────────────────────────────────────────
type Props = {
    data: LocationData;
    locale: string;
};

// ── Component ─────────────────────────────────────────────────
export default function LocationService({ data, locale }: Props) {
    const isId = locale === "id";
    const content = isId ? data.id : data.en;
    const process = isId ? PROCESS.id : PROCESS.en;

    return (
        <div className={styles.page}>
            {/* ── HERO ─────────────────────────────────────── */}
            <section className={styles.hero} aria-labelledby="loc-hero-heading">
                <div className={styles.heroMeta}>
                    <MapPin size={14} aria-hidden="true" />
                    <span>
                        {data.city}, {data.region}
                    </span>
                </div>
                <h1 id="loc-hero-heading" className={styles.heroTitle}>
                    {content.heroTitle}
                </h1>
                <p className={styles.heroSubtitle}>{content.heroSubtitle}</p>
            </section>

            {/* ── LOCAL INTRO ──────────────────────────────── */}
            <section
                className={styles.section}
                aria-labelledby="loc-intro-heading"
            >
                <h2 id="loc-intro-heading" className={styles.sectionTitle}>
                    {content.introTitle}
                </h2>
                <p className={styles.bodyText}>{content.introText}</p>

                {/* Client segments */}
                <ul
                    className={styles.segmentList}
                    aria-label={isId ? "Segmen klien" : "Client segments"}
                >
                    {content.clientSegments.map((seg, i) => (
                        <li key={i} className={styles.segmentItem}>
                            <CheckCircle2
                                size={13}
                                className={styles.checkIcon}
                                aria-hidden="true"
                            />
                            {seg}
                        </li>
                    ))}
                </ul>
            </section>

            {/* ── SERVICES ─────────────────────────────────── */}
            <section
                className={styles.section}
                aria-labelledby="loc-services-heading"
            >
                <span className={styles.sectionLabel}>
                    {isId ? "Layanan" : "Services"}
                </span>
                <h2 id="loc-services-heading" className={styles.sectionTitle}>
                    {isId ? "Yang Saya Tawarkan" : "What I Offer"}
                </h2>

                <div className={styles.serviceGrid}>
                    {SERVICES.map((svc) => {
                        const svcContent = isId ? svc.id : svc.en;
                        return (
                            <div key={svc.key} className={styles.serviceCard}>
                                <div className={styles.serviceIcon}>
                                    {svc.icon}
                                </div>
                                <h3 className={styles.serviceTitle}>
                                    {svcContent.title}
                                </h3>
                                <p className={styles.serviceDesc}>
                                    {svcContent.description}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ── WHY ──────────────────────────────────────── */}
            <section
                className={styles.whySection}
                aria-labelledby="loc-why-heading"
            >
                <h2 id="loc-why-heading" className={styles.sectionTitle}>
                    {content.whyTitle}
                </h2>
                <p className={styles.bodyText}>{content.whyText}</p>
                <ul
                    className={styles.reasonList}
                    aria-label={isId ? "Alasan" : "Reasons"}
                >
                    {content.whyReasons.map((reason, i) => (
                        <li key={i} className={styles.reasonItem}>
                            <span
                                className={styles.reasonNumber}
                                aria-hidden="true"
                            >
                                {String(i + 1).padStart(2, "0")}
                            </span>
                            {reason}
                        </li>
                    ))}
                </ul>
            </section>

            {/* ── PROCESS ──────────────────────────────────── */}
            <section
                className={styles.section}
                aria-labelledby="loc-process-heading"
            >
                <span className={styles.sectionLabel}>
                    {isId ? "Proses" : "Process"}
                </span>
                <h2 id="loc-process-heading" className={styles.sectionTitle}>
                    {isId ? "Bagaimana Proyek Berjalan" : "How a Project Runs"}
                </h2>

                <ol className={styles.processList}>
                    {process.map((step, i) => (
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
                            {i < process.length - 1 && (
                                <div
                                    className={styles.processConnector}
                                    aria-hidden="true"
                                />
                            )}
                        </li>
                    ))}
                </ol>
            </section>

            {/* ── CTA ──────────────────────────────────────── */}
            <section
                className={styles.ctaSection}
                aria-labelledby="loc-cta-heading"
            >
                <h2 id="loc-cta-heading" className={styles.ctaTitle}>
                    {content.ctaTitle}
                </h2>
                <p className={styles.ctaDescription}>
                    {content.ctaDescription}
                </p>
                <Link href={`/${locale}/contact`} className={styles.ctaButton}>
                    {isId ? "Diskusikan Proyek Anda" : "Discuss Your Project"}
                </Link>
            </section>

            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "Service",
                        name: `Jasa Pembuatan Website ${data.city}`,
                        provider: {
                            "@type": "Person",
                            name: "Randy Rafael",
                        },
                        areaServed: {
                            "@type": "Place",
                            name: `${data.city}`,
                        },
                        serviceType: "Website Development",
                        url: `${BASE_URL}/${locale}/services/${data.slug}`,
                    }),
                }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "BreadcrumbList",
                        itemListElement: [
                            {
                                "@type": "ListItem",
                                position: 1,
                                name: "Services",
                                item: `${BASE_URL}/${locale}/services`,
                            },
                            {
                                "@type": "ListItem",
                                position: 2,
                                name: `Website ${data.city}`,
                                item: `${BASE_URL}/${locale}/services/${data.slug}`,
                            },
                        ],
                    }),
                }}
            />
        </div>
    );
}
