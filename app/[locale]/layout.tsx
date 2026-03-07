import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { type Locale } from "@/i18n";
import PianoSidebar from "@/components/PianoSidebar/PianoSidebar";
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
                {children}
            </ActiveSectionProvider>
        </NextIntlClientProvider>
    );
}
