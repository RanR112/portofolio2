"use client";

// components/sections/TechStack/TechStack.tsx
// Step 18: Replaced StackedCards with FloatingTechOrbit.

import {
    SiReact,
    SiNextdotjs,
    SiTypescript,
    SiSass,
    SiNodedotjs,
    SiExpress,
    SiPostgresql,
    SiMongodb,
    SiPrisma,
    SiDocker,
    SiJavascript,
    SiJsonwebtokens,
    SiFusionauth,
    SiSupabase,
    SiMysql,
    SiGit,
    SiPostman,
    SiVercel,
    SiCpanel,
    SiLaravel,
} from "react-icons/si";
import { VscServerProcess } from "react-icons/vsc";
import SectionWrapper from "@/components/SectionWrapper/SectionWrapper";
import styles from "./TechStack.module.scss";
import OrbitImages from "@/components/ui/OrbitImages/OrbitImages";
import { useTranslations } from "next-intl";

// ============================================================
// Icon registry — maps exact item.name → icon element
// Falls back to a generic icon when no match exists.
// ============================================================

function GenericIcon() {
    return (
        <svg
            width="1em"
            height="1em"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            aria-hidden="true"
        >
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="M8 12h8M12 8v8" />
        </svg>
    );
}

const TECH_ICONS: Record<string, React.ReactNode> = {
    // Frontend
    React: <SiReact />,
    "Next.js": <SiNextdotjs />,
    TypeScript: <SiTypescript />,
    JavaScript: <SiJavascript />,
    SCSS: <SiSass />,

    // Backend
    "Node.js": <SiNodedotjs />,
    Express: <SiExpress />,
    "REST APIs": <VscServerProcess />,
    JWT: <SiJsonwebtokens />,
    OAuth: <SiFusionauth />,
    Supabase: <SiSupabase />,
    Laravel: <SiLaravel />,

    // Database
    PostgreSQL: <SiPostgresql />,
    MySQL: <SiMysql />,
    MongoDB: <SiMongodb />,
    "Prisma ORM": <SiPrisma />,

    // Tools
    Git: <SiGit />,
    Docker: <SiDocker />,
    Postman: <SiPostman />,
    Vercel: <SiVercel />,
    cPanel: <SiCpanel />,
};

function TechIcon({ name, size = 28 }: { name: string; size?: number }) {
    const icon = TECH_ICONS[name] ?? <GenericIcon />;
    return (
        <span
            className={styles.techIcon}
            style={{ fontSize: size }}
            aria-hidden="true"
        >
            {icon}
        </span>
    );
}

// ============================================================
// Data — existing, unmodified
// ============================================================

type TechItem = { name: string; note?: string };
type TechCategory = { id: string; label: string; items: TechItem[] };

const TECH_CATEGORIES: TechCategory[] = [
    {
        id: "frontend",
        label: "Frontend Engineering",
        items: [
            { name: "React" },
            { name: "Next.js" },
            { name: "TypeScript" },
            { name: "JavaScript" },
            { name: "SCSS" },
        ],
    },
    {
        id: "backend",
        label: "Backend & API",
        items: [
            { name: "Node.js" },
            { name: "Express" },
            { name: "REST APIs" },
            { name: "JWT" },
            { name: "OAuth" },
            { name: "Supabase" },
            { name: "Laravel" },
        ],
    },
    {
        id: "database",
        label: "Database System",
        items: [
            { name: "PostgreSQL" },
            { name: "MySQL" },
            { name: "MongoDB" },
            { name: "Prisma ORM" },
        ],
    },
    {
        id: "tools",
        label: "Dev Tools & Deployment",
        items: [
            { name: "Git" },
            { name: "Docker" },
            { name: "Postman" },
            { name: "Vercel" },
            { name: "cPanel" },
        ],
    },
];

// ============================================================
// Main TechStack section
// ============================================================

export default function TechStack() {
    const t = useTranslations("stack");

    return (
        <SectionWrapper
            id="stack"
            label={t("label")}
            title={t("title")}
            subtitle={t("subtitle")}
        >
            <div className={styles.layout}>
                {/* Left — logo card grid */}
                <div className={styles.grid}>
                    {TECH_CATEGORIES.map((category) => (
                        <div key={category.id} className={styles.category}>
                            <h3 className={styles.categoryLabel}>
                                {category.label}
                            </h3>

                            <ul
                                className={styles.itemGrid}
                                aria-label={`${category.label} technologies`}
                            >
                                {category.items.map((item) => (
                                    <li key={item.name} className={styles.item}>
                                        <TechIcon name={item.name} size={28} />
                                        <span className={styles.itemName}>
                                            {item.name}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Right — floating orbit visualization */}
                <div className={styles.sidePanel}>
                    <OrbitImages
                        images={Object.values(TECH_ICONS)}
                        shape="ellipse"
                        radiusX={440}
                        radiusY={200}
                        rotation={-8}
                        duration={40}
                        itemSize={100}
                        responsive
                        direction="normal"
                        fill
                        showPath={true}
                        paused={false}
                    />
                </div>
            </div>
        </SectionWrapper>
    );
}
