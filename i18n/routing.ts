// i18n/routing.ts
// Centralized routing config — imported by both middleware and navigation helpers.
// Edge Runtime safe: only imports from 'next-intl/routing', zero Node.js APIs.

import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
    locales: ["en", "id"],
    defaultLocale: "en",
    localePrefix: "always",
});
