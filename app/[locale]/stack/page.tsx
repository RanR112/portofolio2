// app/[locale]/stack/page.tsx

import PageShell from "@/components/layout/PageShell/PageShell";
import TechStack from "@/components/sections/TechStack/TechStack";
import { buildPageMetadata, type MetaProps } from "@/lib/pageMetadata";

export async function generateMetadata({ params }: MetaProps) {
    const { locale } = await params;
    return buildPageMetadata(locale, "stack", "/stack");
}

export default function StackPage() {
    return (
        <PageShell>
            <TechStack />
        </PageShell>
    );
}
