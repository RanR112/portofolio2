// app/page.tsx — Homepage (/)
// Dashboard section is the landing page.

import PageShell from "@/components/layout/PageShell/PageShell";
import TechStack from "@/components/sections/TechStack/TechStack";

export const metadata = { title: "Stack" };


export default function HomePage() {
    return (
        <PageShell>
            <TechStack />
        </PageShell>
    );
}
