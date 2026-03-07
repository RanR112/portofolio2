import { getRequestConfig } from "next-intl/server";
import { routing, type Locale } from "./routing";

// export const locales = ["en", "id"] as const;
// export const defaultLocale = "en" as const;

// export type Locale = (typeof locales)[number];

export default getRequestConfig(async ({ locale }) => {
    // if (!locales.includes(locale as Locale)) notFound();
    const currentLocale =
        locale && routing.locales.includes(locale as Locale) ? locale : routing.defaultLocale;

    const messages = (await import(`../messages/${currentLocale}.json`))
        .default;

    return {
        locale: currentLocale,
        messages,
    };
});
