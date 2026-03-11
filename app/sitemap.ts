import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL;

const locales = ["en", "id"];

const routes = [
    "",
    "/about",
    "/comments",
    "/contact",
    "/music",
    "/piano",
    "/privacy-policy",
    "/projects",
    "/stack",
    "/timeline",
    "/services",
];

const serviceSlugs = [
    "website-banjarnegara",
    "website-purwokerto",
    "website-wonosobo",
    "website-karawang",
];

export default function sitemap(): MetadataRoute.Sitemap {
    const sitemap: MetadataRoute.Sitemap = [];

    for (const locale of locales) {
        // main pages
        for (const route of routes) {
            sitemap.push({
                url: `${baseUrl}/${locale}${route}`,
                lastModified: new Date(),
                changeFrequency: route === "" ? "weekly" : "monthly",
                priority: route === "" ? 1 : 0.8,
            });
        }

        // service pages
        for (const slug of serviceSlugs) {
            sitemap.push({
                url: `${baseUrl}/${locale}/services/${slug}`,
                lastModified: new Date(),
                changeFrequency: "monthly",
                priority: 0.9,
            });
        }
    }

    return sitemap;
}
