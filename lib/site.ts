// lib/site.ts
//
// Single source of truth for the canonical site origin.
//
// - In local dev, NEXT_PUBLIC_SITE_URL is http://localhost:3000 (from .env),
//   so generated URLs point at localhost while developing — intended.
// - In production, set NEXT_PUBLIC_SITE_URL=https://randyrafael.my.id in the
//   host environment (e.g. Vercel). The non-www fallback below guards against a
//   missing env so sitemap.xml / robots.txt / canonicals never emit localhost
//   or a www/non-www mismatch.
//
// Canonical form is non-www; configure a www → non-www redirect at the host.

export const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://randyrafael.my.id";
