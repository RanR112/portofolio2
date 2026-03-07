// i18n.ts
// Locale constants — safe to import in middleware (Edge Runtime).
// getRequestConfig lives in i18n/request.ts (Node.js runtime only).

export const locales = ["en", "id"] as const;
export const defaultLocale = "en" as const;

export type Locale = (typeof locales)[number];
