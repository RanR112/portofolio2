import Services from "@/components/sections/Services/Services";
import PageShell from "@/components/layout/PageShell/PageShell";

export const metadata = { title: "Services" };

export default function ServicesPage() {
    return (
        <PageShell>
            <Services />
        </PageShell>
    );
}
