// app/page.tsx — Homepage (/)
// Dashboard section is the landing page.

import PageShell from "@/components/layout/PageShell/PageShell";
import Contact from "@/components/sections/Contact/Contact";

export const metadata = { title: "Contact" };


export default function HomePage() {
    return (
        <PageShell>
            <Contact />
        </PageShell>
    );
}
