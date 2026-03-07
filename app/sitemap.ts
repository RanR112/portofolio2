import type { MetadataRoute } from "next";

const baseUrl = "https://randyrafael.my.id";

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
];

export default function sitemap(): MetadataRoute.Sitemap {
    const sitemap: MetadataRoute.Sitemap = [];

    for (const locale of locales) {
        for (const route of routes) {
            sitemap.push({
                url: `${baseUrl}/${locale}${route}`,
                lastModified: new Date(),
                changeFrequency: "monthly",
                priority: route === "" ? 1 : 0.7,
            });
        }
    }

    return sitemap;
}
