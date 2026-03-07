// app/page.tsx — Homepage (/)
// Dashboard section is the landing page.

import PageShell from "@/components/layout/PageShell/PageShell";
import MusicConsole from "@/components/sections/MusicConsole/MusicConsole";

export const metadata = { title: "Music" };


export default function HomePage() {
    return (
        <PageShell>
            <MusicConsole />
        </PageShell>
    );
}
