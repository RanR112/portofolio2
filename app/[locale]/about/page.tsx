// app/page.tsx — Homepage (/)
// Dashboard section is the landing page.

import PageShell from "@/components/layout/PageShell/PageShell";
import About from "@/components/sections/About/About";

export const metadata = { title: "About" };


export default function HomePage() {
    return (
        <PageShell>
            <About />
        </PageShell>
    );
}
