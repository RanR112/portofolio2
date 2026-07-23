// lib/pageMetadata.ts
//
// Builds localized <title>/<description> + canonical/hreflang/OG metadata for a
// content page from the `meta` namespace in messages/[locale].json.
//
// Usage in a page:
//   export async function generateMetadata({ params }: MetaProps) {
//       const { locale } = await params;
//       return buildPageMetadata(locale, "about", "/about");
//   }

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SITE_URL } from "@/lib/site";

export type MetaKey =
    | "about"
    | "stack"
    | "projects"
    | "services"
    | "timeline"
    | "music"
    | "piano"
    | "contact"
    | "comments";

export type MetaProps = {
    params: Promise<{ locale: string }>;
};

export async function buildPageMetadata(
    locale: string,
    key: MetaKey,
    path: string,
): Promise<Metadata> {
    const t = await getTranslations({ locale, namespace: "meta" });
    const title = t(`${key}.title`);
    const description = t(`${key}.description`);
    const url = `${SITE_URL}/${locale}${path}`;

    return {
        title,
        description,
        alternates: {
            canonical: url,
            languages: {
                en: `${SITE_URL}/en${path}`,
                id: `${SITE_URL}/id${path}`,
            },
        },
        openGraph: {
            title,
            description,
            url,
            siteName: "Randy Rafael",
            locale: locale === "id" ? "id_ID" : "en_US",
            type: "website",
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
        },
    };
}
