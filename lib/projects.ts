// lib/projects.ts
// Step 20: Text fields (title, description, longDescription) moved to
// messages/[locale].json under projects.items.[id].
// Components resolve text via useTranslations('projects') + project.id.
// Only locale-invariant fields remain here.

import { BalaTeater, BimbaIFE, DriveGallerySystem, Enerkomp, Galatix, KanbanRequest, TeaterBara, Tetris, TokoOnline, TypingTest, WJTour } from "@/assets/index.assets";
import { StaticImageData } from "next/image";

export type Project = {
    id: string;
    title: string;
    tags: string[];
    category: "web" | "game" | "platform" | "tool";
    status: "live" | "wip" | "archived";
    year: number;
    featured: boolean;
    thumbnail: string | StaticImageData;
    repoUrl?: string;
    liveUrl?: string;
};

export const PROJECTS: Project[] = [
    {
        id: "enerkomp",
        title: "Enerkomp",
        tags: ["React", "TypeScript", "SCSS", "Express", "Prisma", "MySQL"],
        category: "web",
        status: "live",
        year: 2025,
        featured: true,
        thumbnail: Enerkomp,
        liveUrl: "https://www.enerkomp.co.id",
    },
    {
        id: "kanban-request",
        title: "Kanban Request System",
        tags: ["React", "Express", "SCSS", "PostgreSQL", "Prisma"],
        category: "web",
        status: "archived",
        year: 2025,
        featured: true,
        thumbnail: KanbanRequest,
    },
    {
        id: "teater-bara",
        title: "Teater Bara",
        tags: ["React", "TypeScript", "SCSS"],
        category: "web",
        status: "live",
        year: 2026,
        featured: true,
        thumbnail: TeaterBara,
        repoUrl: "https://github.com/RanR112/teaterbara",
        liveUrl: "https://www.teaterbara.my.id/",
    },
    {
        id: "drive-gallery-system",
        title: "Drive Gallery System",
        tags: ["Express", "TypeScript", "Google Drive API"],
        category: "tool",
        status: "live",
        year: 2026,
        featured: false,
        thumbnail: DriveGallerySystem,
        repoUrl: "https://github.com/RanR112/be-teaterbara",
    },
    {
        id: "bala-teater",
        title: "Bala Teater",
        tags: ["React", "SCSS", "AppScript", "SpreadSheet"],
        category: "web",
        status: "live",
        year: 2025,
        featured: false,
        thumbnail: BalaTeater,
        repoUrl: "https://github.com/RanR112/balateater-2",
        liveUrl: "https://www.balateater.my.id/"
    },
    {
        id: "tetris",
        title: "Tetris",
        tags: ["React", "SCSS"],
        category: "game",
        status: "live",
        year: 2025,
        featured: false,
        thumbnail: Tetris,
        repoUrl: "https://github.com/RanR112/tetris",
        liveUrl: "https://tetris-digidaw.vercel.app/"
    },
    {
        id: "typing-test",
        title: "Typing Test",
        tags: ["React", "SCSS"],
        category: "platform",
        status: "live",
        year: 2025,
        featured: false,
        thumbnail: TypingTest,
        repoUrl: "https://github.com/RanR112/typing-test",
        liveUrl: "https://typing-test-ran.vercel.app/"
    },
    {
        id: "wj-tour",
        title: "WJ Tour",
        tags: ["React", "Express", "SCSS", "MySQL"],
        category: "web",
        status: "live",
        year: 2024,
        featured: false,
        thumbnail: WJTour,
        repoUrl: "https://github.com/RanR112/travel-fullstack",
        liveUrl: "https://wjtour.vercel.app/"
    },
    {
        id: "bimba-ife",
        title: "Bimba IFE",
        tags: ["React", "SCSS"],
        category: "web",
        status: "archived",
        year: 2024,
        featured: false,
        thumbnail: BimbaIFE,
        liveUrl: "https://bimbaife.vercel.app/"
    },
    {
        id: "toko-online",
        title: "Toko Online",
        tags: ["Laravel", "Midtrans", "OAuth", "Raja Ongkir"],
        category: "web",
        status: "archived",
        year: 2025,
        featured: false,
        thumbnail: TokoOnline,
        repoUrl: "https://github.com/RanR112/tokoonline",
    },
    {
        id: "galatix",
        title: "Galatix",
        tags: ["React", "Express", "MongoDB"],
        category: "web",
        status: "wip",
        year: 2025,
        featured: false,
        thumbnail: Galatix,
        repoUrl: "https://github.com/RanR112/galatix-be",
    },
];
