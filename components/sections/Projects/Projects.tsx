"use client";

// components/sections/Projects/Projects.tsx
// Step 20: Section header strings resolved via useTranslations('projects').

import { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import SectionWrapper from "@/components/SectionWrapper/SectionWrapper";
import ProjectCard from "@/components/ProjectCard/ProjectCard";
import { PROJECTS, type Project } from "@/lib/projects";
import styles from "./Projects.module.scss";

const ProjectDetailModal = dynamic(
    () => import("@/components/ProjectDetailModal/ProjectDetailModal"),
    { ssr: false },
);

export default function Projects() {
    const t = useTranslations("projects");
    const [selectedProject, setSelectedProject] = useState<Project | null>(
        null,
    );
    // Holds the ref of the Details button that triggered the modal,
    // so focus returns to it when the modal closes.
    const triggerRef = useRef<HTMLElement>(null);

    const sorted = [...PROJECTS].sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        return b.year - a.year;
    });

    const handleViewDetails = useCallback(
        (id: string, ref: React.RefObject<HTMLElement>) => {
            const project = PROJECTS.find((p) => p.id === id) ?? null;
            // Copy the ref value into our stable ref so the modal can return focus
            (triggerRef as React.MutableRefObject<HTMLElement | null>).current =
                ref.current;
            setSelectedProject(project);
        },
        [],
    );

    const handleCloseModal = useCallback(() => {
        setSelectedProject(null);
    }, []);

    return (
        <>
            <SectionWrapper
                id="projects"
                label={t("label")}
                title={t("title")}
                subtitle={t("subtitle")}
            >
                <div className={styles.grid}>
                    {sorted.map((project) => (
                        <ProjectCard
                            key={project.id}
                            project={project}
                            onViewDetails={handleViewDetails}
                        />
                    ))}
                </div>
            </SectionWrapper>

            {/* Modal renders outside SectionWrapper so it escapes any overflow clip */}
            <ProjectDetailModal
                project={selectedProject}
                onClose={handleCloseModal}
                triggerRef={triggerRef as React.RefObject<HTMLElement>}
            />
        </>
    );
}
