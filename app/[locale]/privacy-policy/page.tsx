// app/[locale]/privacy-policy/page.tsx
//
// Server component — reads translations at request time.
// No client-side JS needed for static text content.

import { getTranslations } from "next-intl/server";
import PageShell from "@/components/layout/PageShell/PageShell";
import PrivacyPolicyContent from "@/components/sections/PrivacyPolicy/PrivacyPolicy";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;

    const t = await getTranslations({ locale, namespace: "privacy" });

    return {
        title: t("title"),
    };
}

export default function PrivacyPolicyPage() {
    return (
        <PageShell>
            <PrivacyPolicyContent />
        </PageShell>
    );
}
