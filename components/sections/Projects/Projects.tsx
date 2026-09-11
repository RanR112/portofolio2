"use client";

// components/sections/Projects/Projects.tsx
// Step 20: Section header strings resolved via useTranslations('projects').
//
// [BARU] Membuka modal detail otomatis lewat query param ?project=<id> —
// dipakai FeaturedProjects di home supaya klik proyek unggulan langsung ke
// /projects DAN membuka detailnya, bukan cuma mendarat di listing. Pola
// query-param dipilih (bukan sessionStorage seperti flag piano:fullscreen
// di MusicConsole) karena URL-nya jadi valid untuk dibagikan/dibuka
// langsung juga, bukan cuma untuk transisi client-side.

import { useState, useCallback, useRef, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import SectionWrapper from "@/components/SectionWrapper/SectionWrapper";
import ProjectCard from "@/components/ProjectCard/ProjectCard";
import Reveal from "@/components/ui/Reveal/Reveal";
import { PROJECTS, type Project } from "@/lib/projects";
import styles from "./Projects.module.scss";

const ProjectDetailModal = dynamic(
    () => import("@/components/ProjectDetailModal/ProjectDetailModal"),
    { ssr: false },
);

// [BARU] useSearchParams() mewajibkan Suspense boundary sendiri di App
// Router (kalau tidak, seluruh halaman ikut ter-deopt dari static
// rendering). Diisolasi ke komponen kecil ini — tidak me-render apa pun,
// cuma efek samping membaca query param sekali lalu memanggil onOpen.
function OpenProjectFromQuery({
    onOpen,
}: {
    onOpen: (id: string) => void;
}) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const id = searchParams.get("project");
        if (!id) return;

        onOpen(id);
        // Bersihkan query param dari URL setelah dipakai — supaya refresh
        // atau tombol back tidak membuka modal yang sama berulang, dan URL
        // kembali bersih setelah tujuannya tercapai.
        router.replace(pathname, { scroll: false });
        // onOpen sengaja tidak masuk dependency array — identitasnya sudah
        // stabil (dibungkus useCallback dengan deps kosong di Projects),
        // dan efek ini memang hanya boleh bereaksi pada perubahan query param.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, router, pathname]);

    return null;
}

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

    // [BARU] Dipanggil oleh OpenProjectFromQuery saat ?project=<id> ada di
    // URL. ID tidak valid diabaikan diam-diam (tidak melempar error) —
    // konsisten dengan handleViewDetails yang juga toleran terhadap id
    // yang tidak ditemukan.
    const openFromQuery = useCallback((id: string) => {
        const project = PROJECTS.find((p) => p.id === id) ?? null;
        if (!project) return;

        // Cari tombol Details proyek ini di DOM supaya fokus kembali ke
        // sana saat modal ditutup — sama seperti alur klik manual, walau
        // di sini tidak ada klik nyata yang memicunya.
        const btn = document.querySelector<HTMLElement>(
            `[data-project-id="${id}"]`,
        );
        (triggerRef as React.MutableRefObject<HTMLElement | null>).current =
            btn;
        setSelectedProject(project);
    }, []);

    return (
        <>
            <Suspense fallback={null}>
                <OpenProjectFromQuery onOpen={openFromQuery} />
            </Suspense>

            <SectionWrapper
                id="projects"
                label={t("label")}
                title={t("title")}
                subtitle={t("subtitle")}
            >
                <Reveal>
                    <div className={styles.grid}>
                        {sorted.map((project) => (
                            <ProjectCard
                                key={project.id}
                                project={project}
                                onViewDetails={handleViewDetails}
                            />
                        ))}
                    </div>
                </Reveal>
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
