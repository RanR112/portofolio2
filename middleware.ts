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
        // "piano/songs" = data lagu di public/piano/songs* (hasil generate
        // scripts/buildSongs.mjs), BUKAN route /[locale]/piano. Tanpa
        // dikecualikan, localePrefix "always" akan mengalihkan
        // /piano/songs-index.json ke /en/piano/songs-index.json dan fetch-nya
        // gagal. Pola yang sama sudah dipakai untuk audio/icons/images.
        //
        // Sengaja "piano/songs", bukan "piano": kalau seluruh prefix "piano"
        // dikecualikan, /piano tanpa locale tidak lagi dialihkan ke /en/piano
        // dan malah jadi 404.
        "/((?!api|_next|_vercel|audio|piano/songs|sitemap.xml|robots.txt|icons|images|opengraph-image|twitter-image|site\\.webmanifest).*)",
    ],
};
