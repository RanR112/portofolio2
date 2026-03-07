"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { useNavItems } from "@/lib/navItems";

type ActiveSectionContextValue = {
    activeId: string;
    activeItem: ReturnType<typeof useNavItems>[number] | undefined;
    locale: string;
};

const ActiveSectionContext = createContext<ActiveSectionContextValue | null>(
    null,
);

export function ActiveSectionProvider({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const locale = useLocale();

    // ✅ Panggil hook di top level
    const navItems = useNavItems();

    const value = useMemo(() => {
        const prefix = `/${locale}`;

        const routePath = pathname.startsWith(prefix)
            ? pathname.slice(prefix.length) || "/"
            : pathname;

        const activeItem =
            navItems.find((item) => item.route === routePath) ?? navItems[0];

        return {
            activeId: activeItem.id,
            activeItem,
            locale,
        };
    }, [pathname, locale, navItems]);

    return (
        <ActiveSectionContext.Provider value={value}>
            {children}
        </ActiveSectionContext.Provider>
    );
}

export function useActiveSectionContext(): ActiveSectionContextValue {
    const ctx = useContext(ActiveSectionContext);
    if (!ctx) {
        throw new Error(
            "useActiveSectionContext must be used within ActiveSectionProvider",
        );
    }
    return ctx;
}
