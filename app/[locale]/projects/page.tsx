// app/[locale]/projects/page.tsx

import PageShell from "@/components/layout/PageShell/PageShell";
import Projects from "@/components/sections/Projects/Projects";
import { buildPageMetadata, type MetaProps } from "@/lib/pageMetadata";

export async function generateMetadata({ params }: MetaProps) {
    const { locale } = await params;
    return buildPageMetadata(locale, "projects", "/projects");
}

export default function ProjectsPage() {
    return (
        <PageShell>
            <Projects />
        </PageShell>
    );
}
