// app/page.tsx — Homepage (/)
// Dashboard section is the landing page.

import PageShell from "@/components/layout/PageShell/PageShell";
import CareerTimeline from "@/components/sections/CareerTimeline/CareerTimeline";

export const metadata = { title: "Timeline" };


export default function HomePage() {
    return (
        <PageShell>
            <CareerTimeline />
        </PageShell>
    );
}
