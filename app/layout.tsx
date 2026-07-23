// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next"
import "../styles/globals.scss";

// import LightPillar from "@/components/ui/LightPillar/LightPillar";
import { NextIntlClientProvider } from "next-intl";
import dynamic from "next/dynamic";
import { SITE_URL } from "@/lib/site";

const LightPillar = dynamic(
    () => import("@/components/ui/LightPillar/LightPillar"),
);

// ---- Canonical site URL — single source of truth in lib/site.ts ----
const SITE_NAME = "Randy Rafael";
const SITE_TITLE = "Randy Rafael — Fullstack Developer & System Builder";
const SITE_DESCRIPTION =
    "Portfolio of Randy Rafael — fullstack developer and system builder.";

export const metadata: Metadata = {
    // ---- Title ----
    title: {
        default: SITE_TITLE,
        template: `%s | ${SITE_NAME}`,
    },

    // ---- Core ----
    description: SITE_DESCRIPTION,
    authors: [{ name: SITE_NAME, url: SITE_URL }],
    creator: SITE_NAME,
    keywords: [
        "fullstack developer",
        "Next.js",
        "TypeScript",
        "React",
        "Node.js",
        "portfolio",
        "Indonesia",
        "Jakarta",
        "Karawang",
        "Banjarnegara",
        "Purwokerto",
        "Wonosobo",
        "web developer",
    ],

    // ---- Canonical URL ----
    metadataBase: new URL(SITE_URL),
    alternates: { canonical: "/" },

    // ---- Robots ----
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
        },
    },

    // ---- Open Graph ----
    openGraph: {
        type: "website",
        locale: "en_US",
        url: SITE_URL,
        siteName: SITE_NAME,
        title: SITE_TITLE,
        description: SITE_DESCRIPTION,
        // og:image is generated dynamically by app/opengraph-image.tsx
    },

    // ---- Twitter / X ----
    twitter: {
        card: "summary_large_image",
        title: SITE_TITLE,
        description: SITE_DESCRIPTION,
        // creator:  '@yourhandle', // uncomment when you have one
        // twitter:image is generated dynamically by app/twitter-image.tsx
    },

    // ---- Favicon / Icons ----
    // Place these files in /public/icons/
    icons: {
        icon: "/icons/logo.jpg",
        shortcut: "/icons/logo.jpg",
        apple: "/icons/logo.jpg",
        other: [
            {
                rel: "icon",
                url: "/icons/logo.jpg",
                sizes: "32x32",
                type: "image/jpg",
            },
            {
                rel: "icon",
                url: "/icons/logo.jpg",
                sizes: "16x16",
                type: "image/jpg",
            },
        ],
    },
    // icons: {
    //     icon: "/icons/favicon.ico",
    //     shortcut: "/icons/favicon-16x16.png",
    //     apple: "/icons/apple-touch-icon.png",
    //     other: [
    //         {
    //             rel: "icon",
    //             url: "/icons/favicon-32x32.png",
    //             sizes: "32x32",
    //             type: "image/png",
    //         },
    //         {
    //             rel: "icon",
    //             url: "/icons/favicon-16x16.png",
    //             sizes: "16x16",
    //             type: "image/png",
    //         },
    //     ],
    // },

    // ---- Manifest ----
    manifest: "/site.webmanifest",
};

// ---- Viewport — exported separately per Next.js 14+ convention ----
export const viewport: Viewport = {
    // Dark-only site — force the browser UI to match regardless of OS scheme.
    themeColor: "#0e0f11",
    width: "device-width",
    initialScale: 1,
    // Prevent font bump on iOS orientation change
    maximumScale: 5,
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        // Dark-only site — data-theme is a static marker; nothing mutates it.
        <html lang="en" data-theme="dark">
            <body>
                <NextIntlClientProvider>
                    {/*
          Skip navigation link — keyboard/screen reader users can jump past
          the sidebar to the main content area with a single Tab + Enter.
          Visually hidden until focused. Defined in globals.scss (.skip-nav).
        */}
                    <a href="#main-content" className="skip-nav">
                        Skip to content
                    </a>

                    {/*
          ThreeBackground — position:fixed canvas behind everything.
          Placed OUTSIDE the provider tree so it is never affected by
          context updates or route changes. React.memo ensures it never
          re-renders. The Three.js WebGL renderer is created once and
          persists for the full session.
        */}
                    <div className="mainBackground">
                        <LightPillar
                            topColor="#c9a86c"
                            bottomColor="#9a7840"
                            intensity={1}
                            rotationSpeed={0.3}
                            glowAmount={0.002}
                            pillarWidth={3}
                            pillarHeight={0.4}
                            noiseIntensity={0.5}
                            pillarRotation={25}
                            interactive={false}
                            mixBlendMode="screen"
                            quality="medium"
                        />
                    </div>
                    <Analytics/>

                    {/*
          ActiveSectionProvider lives in app/[locale]/layout.tsx — every
          consumer (Topbar, sidebar) renders inside that locale subtree.
        */}
                    <div className="app-shell">
                        {/*
              PageTransition wraps {children} — fades out the old page,
              swaps the DOM, then fades in the new page.
              ThreeBackground is outside this wrapper so it never fades.
            */}
                        {/* <RouteTransition> */}
                        {children}
                        {/* </RouteTransition> */}
                    </div>
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
