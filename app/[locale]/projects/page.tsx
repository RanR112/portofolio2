// app/page.tsx — Homepage (/)
// Dashboard section is the landing page.

import PageShell from "@/components/layout/PageShell/PageShell";
import Projects from "@/components/sections/Projects/Projects";

export const metadata = { title: "Projects" };


export default function HomePage() {
    return (
        <PageShell>
            <Projects />
        </PageShell>
    );
}
