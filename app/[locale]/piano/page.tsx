// app/[locale]/piano/page.tsx

import Piano from "@/components/sections/Piano/Piano";
import { buildPageMetadata, type MetaProps } from "@/lib/pageMetadata";

export async function generateMetadata({ params }: MetaProps) {
    const { locale } = await params;
    return buildPageMetadata(locale, "piano", "/piano");
}

export default function PianoPage() {
    return <Piano />;
}
