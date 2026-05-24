// app/sitemap.ts
import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = "https://www.randyrafael.my.id";

    // Daftar rute beserta nilai prioritasnya
    const routes = [
        // Priority 1.00
        { path: "/en", priority: 1.0 },
        { path: "/en/services", priority: 1 },
        { path: "/en/services/website-banjarnegara", priority: 1 },
        { path: "/en/services/website-karawang", priority: 1 },
        { path: "/en/services/website-purwokerto", priority: 1 },
        { path: "/en/services/website-wonosobo", priority: 1 },
        { path: "/id/services", priority: 1 },
        { path: "/id/services/website-banjarnegara", priority: 1 },
        { path: "/id/services/website-karawang", priority: 1 },
        { path: "/id/services/website-purwokerto", priority: 1 },
        { path: "/id/services/website-wonosobo", priority: 1 },

        // Priority 0.80
        { path: "/en/about", priority: 0.8 },
        { path: "/en/stack", priority: 0.8 },
        { path: "/en/projects", priority: 0.8 },
        { path: "/en/timeline", priority: 0.8 },
        { path: "/en/music", priority: 0.8 },
        { path: "/en/contact", priority: 0.8 },
        { path: "/en/comments", priority: 0.8 },
        { path: "/id", priority: 0.8 },

        // Priority 0.64
        { path: "/id/about", priority: 0.64 },
        { path: "/id/stack", priority: 0.64 },
        { path: "/id/projects", priority: 0.64 },
        { path: "/id/timeline", priority: 0.64 },
        { path: "/id/music", priority: 0.64 },
        { path: "/en/piano", priority: 0.64 },
        { path: "/id/contact", priority: 0.64 },
        { path: "/id/comments", priority: 0.64 },
        { path: "/en/privacy-policy", priority: 0.64 },

        // Priority 0.51
        { path: "/id/piano", priority: 0.51 },
        { path: "/id/privacy-policy", priority: 0.51 },
    ];

    // Map data di atas menjadi format yang dibaca oleh Next.js
    return routes.map((route) => ({
        url: `${baseUrl}${route.path}`,
        lastModified: new Date(), // Otomatis menggunakan tanggal dan waktu saat situs di-build
        priority: route.priority,
    }));
}
