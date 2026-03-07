// middleware.ts
// Intercepts every request and ensures a locale prefix is present in the URL.
// /about       → redirect to /en/about  (or /id/about if browser prefers ID)
// /en/about    → pass through
// /id/about    → pass through
//
// next-intl's createMiddleware handles:
//   - Locale detection from Accept-Language header
//   - Cookie-based locale persistence (after language switcher sets it)
//   - Redirect for locale-less paths
//   - Static asset passthrough (/_next, /api, /icons, etc.)

import createMiddleware from "next-intl/middleware";

export default createMiddleware({
    locales: ["en", "id"],
    defaultLocale: "en",
    // Store the user's locale choice in a cookie so it persists across sessions
    localePrefix: "always",
    // localeDetection: false,
});

export const config = {
    // Run middleware on all routes except Next.js internals and static files
    matcher: [
        "/((?!_next|_vercel|api|icons|images|og-image\\.png|site\\.webmanifest|.*\\..*).*)",
    ],
};
