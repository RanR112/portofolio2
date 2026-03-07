// lib/navItems.ts
//
// Single source of truth for sidebar navigation.
// Step 10: Multi-page architecture.
//   - `route`   — Next.js page path (used for Link href and active detection)
//   - `note`    — Solfège syllable (Do Re Mi Fa Sol La Si Do) for audio feedback
//   - `isBlack` — removed (white keys only from Step 10)
//
// Note mapping: 8 keys = Do(C4) Re(D4) Mi(E4) Fa(F4) Sol(G4) La(A4) Si(B4) Do(C5)

import { Activity, FolderGit2, Layers, LayoutDashboard, MessageSquareMore, Phone, Piano, User } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ReactNode } from "react";

export type NavItem = {
    id: string;
    label: string;
    route: string; // Next.js route for Link and usePathname matching
    note: string; // Web Audio frequency key — maps to NOTE_FREQUENCIES in usePianoAudio
    icon: ReactNode; // Unicode glyph
    shortcut: string; // Display label on hover
};

export function useNavItems(): NavItem[] {
    const t = useTranslations("nav");
    const locale = useLocale(); 

    return [
        {
            id: t("id.dashboard"),
            label: "dashboard",
            route: `/${locale}`,
            note: "C4",
            icon: <LayoutDashboard size={18}/>,
            shortcut: t("label.dashboard"),
        },
        {
            id: t("id.about"),
            label: "about",
            route: `/${locale}/about`,
            note: "D4",
            icon: <User size={18}/>,
            shortcut: t("label.about"),
        },
        {
            id: t("id.stack"),
            label: "stack",
            route: `/${locale}/stack`,
            note: "E4",
            icon: <Layers size={18}/>,
            shortcut: t("label.stack"),
        },
        {
            id: t("id.projects"),
            label: "projects",
            route: `/${locale}/projects`,
            note: "F4",
            icon: <FolderGit2 size={18}/>,
            shortcut: t("label.projects"),
        },
        {
            id: t("id.timeline"),
            label: "timeline",
            route: `/${locale}/timeline`,
            note: "G4",
            icon: <Activity size={18}/>,
            shortcut: t("label.timeline"),
        },
        {
            id: t("id.music"),
            label: "music",
            route: `/${locale}/music`,
            note: "A4",
            icon: <Piano size={18}/>,
            shortcut: t("label.music"),
        },
        {
            id: t("id.contact"),
            label: "contact",
            route: `/${locale}/contact`,
            note: "B4",
            icon: <Phone size={18}/>,
            shortcut: t("label.contact"),
        },
        {
            id: t("id.comments"),
            label: "comments",
            route: `/${locale}/comments`,
            note: "C5",
            icon: <MessageSquareMore size={18}/>,
            shortcut: t("label.comments"),
        },
    ];
}
