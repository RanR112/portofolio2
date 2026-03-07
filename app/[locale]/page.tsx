// app/page.tsx — Homepage (/)
// Dashboard section is the landing page.

import PageShell from "@/components/layout/PageShell/PageShell";
import Dashboard from "@/components/sections/Dashboard/Dashboard";

export const metadata = { title: "Randy Rafael — Fullstack Developer & System Builder" };

export default function HomePage() {
    return (
        <PageShell>
            <Dashboard />
        </PageShell>
    );
}
