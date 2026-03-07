// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { ActiveSectionProvider } from "@/context/ActiveSectionContext";
import { AuthProvider } from "@/context/AuthContext";
import "../styles/globals.scss";

// import LightPillar from "@/components/ui/LightPillar/LightPillar";
import { NextIntlClientProvider } from "next-intl";
import dynamic from "next/dynamic";

const LightPillar = dynamic(
    () => import("@/components/ui/LightPillar/LightPillar"),
);

// ---- Canonical site URL — update before deploying ----
const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://randyrafael.my.id";
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
        images: [
            {
                url: "/og-image.png", // 1200×630 — place in /public
                width: 1200,
                height: 630,
                alt: `${SITE_NAME} — Fullstack Developer`,
            },
        ],
    },

    // ---- Twitter / X ----
    twitter: {
        card: "summary_large_image",
        title: SITE_TITLE,
        description: SITE_DESCRIPTION,
        // creator:  '@yourhandle', // uncomment when you have one
        images: ["/og-image.png"],
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
    themeColor: [
        { media: "(prefers-color-scheme: dark)", color: "#0e0f11" },
        { media: "(prefers-color-scheme: light)", color: "#f5f5f3" },
    ],
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
        /*
         * suppressHydrationWarning: ThemeToggle writes data-theme on the
         * client after hydration. Without this flag React warns on mismatch
         * since the server always renders data-theme="dark".
         */
        <html lang="en" data-theme="dark" suppressHydrationWarning>
            <head>
                {/* Preconnect to Google Fonts domain — eliminates round-trip latency */}
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link
                    rel="preconnect"
                    href="https://fonts.gstatic.com"
                    crossOrigin="anonymous"
                />
            </head>
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

                    {/*
          Provider order (outermost → innermost):
          1. AuthProvider          — session state, sign-in/out helpers
          2. ActiveSectionProvider — pathname-driven active section state
        */}
                    <AuthProvider>
                        <ActiveSectionProvider>
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
                        </ActiveSectionProvider>
                    </AuthProvider>
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
