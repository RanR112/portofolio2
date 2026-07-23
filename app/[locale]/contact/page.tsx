// app/[locale]/contact/page.tsx

import PageShell from "@/components/layout/PageShell/PageShell";
import Contact from "@/components/sections/Contact/Contact";
import { buildPageMetadata, type MetaProps } from "@/lib/pageMetadata";

export async function generateMetadata({ params }: MetaProps) {
    const { locale } = await params;
    return buildPageMetadata(locale, "contact", "/contact");
}

export default function ContactPage() {
    return (
        <PageShell>
            <Contact />
        </PageShell>
    );
}
