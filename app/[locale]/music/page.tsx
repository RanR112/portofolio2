// app/[locale]/music/page.tsx

import PageShell from "@/components/layout/PageShell/PageShell";
import MusicConsole from "@/components/sections/MusicConsole/MusicConsole";
import { buildPageMetadata, type MetaProps } from "@/lib/pageMetadata";

export async function generateMetadata({ params }: MetaProps) {
    const { locale } = await params;
    return buildPageMetadata(locale, "music", "/music");
}

export default function MusicPage() {
    return (
        <PageShell>
            <MusicConsole />
        </PageShell>
    );
}
