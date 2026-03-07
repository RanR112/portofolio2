// i18n/request.ts
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

// Explicit map — no dynamic path, no __dirname
const messageImports = {
    en: () => import("../messages/en.json"),
    id: () => import("../messages/id.json"),
} as const;

export default getRequestConfig(async ({ requestLocale }) => {
    let locale = await requestLocale;

    if (!locale || !routing.locales.includes(locale as any)) {
        locale = routing.defaultLocale;
    }

    const messages = (
        await messageImports[locale as keyof typeof messageImports]()
    ).default;

    return {
        locale,
        messages,
    };
});
