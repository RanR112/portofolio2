// app/[locale]/services/website-[location]/page.tsx

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
    getLocationData,
    LOCATION_SLUGS,
    type LocationSlug,
} from "@/lib/locationServices";
import LocationService from "@/components/sections/LocationService/LocationService";
import PageShell from "@/components/layout/PageShell/PageShell";
import { SITE_URL } from "@/lib/site";

type Params = {
    locale: string;
    slug: string;
};

type Props = {
    params: Promise<Params>;
};

const BASE_URL = SITE_URL;

export function generateStaticParams() {
    const locales = ["en", "id"];

    return locales.flatMap((locale) =>
        LOCATION_SLUGS.map((slug) => ({
            locale,
            slug,
        })),
    );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale, slug } = await params;

    const data = getLocationData(slug as LocationSlug);
    if (!data) return {};

    const content = locale === "id" ? data.id : data.en;

    const url = `${BASE_URL}/${locale}/services/${slug}`;

    const location = slug.split("-")[1];

    return {
        title: content.metaTitle,
        description: content.metaDescription,

        keywords: [
            `jasa pembuatan website ${location}`,
            `web developer ${location}`,
            `buat website ${location}`,
            `jasa website ${location}`,
            `developer website ${location}`,
        ],

        alternates: {
            canonical: url,
            languages: {
                en: `${BASE_URL}/en/services/${slug}`,
                id: `${BASE_URL}/id/services/${slug}`,
            },
        },

        openGraph: {
            title: content.metaTitle,
            description: content.metaDescription,
            url,
            siteName: "Randy Rafael",
            locale: locale === "id" ? "id_ID" : "en_US",
            type: "website",
        },

        twitter: {
            card: "summary_large_image",
            title: content.metaTitle,
            description: content.metaDescription,
        },

        robots: {
            index: true,
            follow: true,
        },
    };
}

export default async function LocationServicePage({ params }: Props) {
    const { locale, slug } = await params;

    const data = getLocationData(slug as LocationSlug);
    if (!data) notFound();

    return (
        <PageShell>
            <LocationService data={data} locale={locale} />
        </PageShell>
    );
}
