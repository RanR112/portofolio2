// app/[locale]/layout.tsx
//
// This layout wraps every localized page.
// It sits INSIDE app/layout.tsx (which provides HTML/body/providers).
//
// Responsibilities:
//   1. Validate the locale param (notFound() if invalid)
//   2. Load the correct messages and wrap children with NextIntlClientProvider
//   3. Pass locale to ActiveSectionProvider via locale prop (for link hrefs)
//
// app/layout.tsx  (root — html, body, PianoSidebar, RouteTransition)
//   └─ app/[locale]/layout.tsx  (this file — i18n provider)
//       └─ app/[locale]/*/page.tsx  (each page)

import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { type Locale } from "@/i18n/routing";
import PianoSidebar from "@/components/PianoSidebar/PianoSidebar";
import ContextMenu from "@/components/ContextMenu/ContextMenu";
import { ActiveSectionProvider } from "@/context/ActiveSectionContext";

type Props = {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
    return ["en", "id"].map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
    const { locale } = await params;

    const messages = await getMessages({ locale });

    return (
        <NextIntlClientProvider locale={locale as Locale} messages={messages}>
            <ActiveSectionProvider>
                <PianoSidebar />
                <ContextMenu />
                {children}
            </ActiveSectionProvider>
        </NextIntlClientProvider>
    );
}
