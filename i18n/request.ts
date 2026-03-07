// i18n.ts
// next-intl configuration — consumed by middleware and server components.

import { getRequestConfig } from "next-intl/server";
import { defaultLocale, locales, type Locale } from '../i18n'

// export const locales = ["en", "id"] as const;
// export const defaultLocale = "en" as const;

// export type Locale = (typeof locales)[number];

export default getRequestConfig(async ({ locale }) => {
    // if (!locales.includes(locale as Locale)) notFound();
    const currentLocale =
        locale && locales.includes(locale as Locale) ? locale : defaultLocale;

    const messages = (await import(`../messages/${currentLocale}.json`)).default;

    return {
        locale: currentLocale,
        messages,
    };
});
