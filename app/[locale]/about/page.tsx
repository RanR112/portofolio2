// app/[locale]/about/page.tsx

import PageShell from "@/components/layout/PageShell/PageShell";
import About from "@/components/sections/About/About";
import { buildPageMetadata, type MetaProps } from "@/lib/pageMetadata";

export async function generateMetadata({ params }: MetaProps) {
    const { locale } = await params;
    return buildPageMetadata(locale, "about", "/about");
}

export default function AboutPage() {
    return (
        <PageShell>
            <About />
        </PageShell>
    );
}
