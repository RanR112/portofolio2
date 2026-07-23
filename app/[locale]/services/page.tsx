import Services from "@/components/sections/Services/Services";
import PageShell from "@/components/layout/PageShell/PageShell";
import { buildPageMetadata, type MetaProps } from "@/lib/pageMetadata";

export async function generateMetadata({ params }: MetaProps) {
    const { locale } = await params;
    return buildPageMetadata(locale, "services", "/services");
}

export default function ServicesPage() {
    return (
        <PageShell>
            <Services />
        </PageShell>
    );
}
