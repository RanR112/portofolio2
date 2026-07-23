// app/[locale]/page.tsx — Homepage (/[locale])
// Dashboard section is the landing page.

import PageShell from "@/components/layout/PageShell/PageShell";
import Dashboard from "@/components/sections/Dashboard/Dashboard";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL } from "@/lib/site";

export const metadata = {
    title: "Randy Rafael — Fullstack Developer & System Builder",
};

export default async function HomePage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;

    // Structured data — helps search engines build a knowledge panel and
    // enables the sitelinks search box. Person + WebSite linked via @id.
    const jsonLd = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Person",
                "@id": `${SITE_URL}/#person`,
                name: "Randy Rafael",
                url: SITE_URL,
                jobTitle: "Fullstack Developer",
                description:
                    "Fullstack developer and system builder based in Indonesia.",
                sameAs: ["https://github.com/RanR112"],
                knowsAbout: [
                    "Next.js",
                    "TypeScript",
                    "React",
                    "Node.js",
                    "Web Development",
                ],
            },
            {
                "@type": "WebSite",
                "@id": `${SITE_URL}/#website`,
                url: SITE_URL,
                name: "Randy Rafael",
                inLanguage: locale === "id" ? "id-ID" : "en-US",
                publisher: { "@id": `${SITE_URL}/#person` },
            },
        ],
    };

    return (
        <PageShell>
            <JsonLd data={jsonLd} />
            <Dashboard />
        </PageShell>
    );
}
