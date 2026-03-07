// app/page.tsx — Homepage (/)
// Dashboard section is the landing page.

import PageShell from "@/components/layout/PageShell/PageShell";
import CommentUI from "@/components/sections/CommentUI/CommentUI";

export const metadata = { title: "Comment" };


export default function HomePage() {
    return (
        <PageShell>
            <CommentUI />
        </PageShell>
    );
}
