// i18n/request.ts
// Server-only. Never touched by middleware.

import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
    let locale = await requestLocale;

    // Fallback if locale is missing or invalid
    if (!locale || !routing.locales.includes(locale as any)) {
        locale = routing.defaultLocale;
    }

    return {
        locale,
        messages: (await import(`../messages/${locale}.json`)).default,
    };
});
