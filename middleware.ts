// middleware.ts
import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "./i18n/routing";

export default createMiddleware({
    locales,
    defaultLocale,
    localePrefix: "always",
    localeCookie: true,
});

export const config = {
    matcher: [
        "/((?!api|_next|_vercel|sitemap.xml|robots.txt|icons|images|og-image\\.png|site\\.webmanifest).*)",
    ],
};
