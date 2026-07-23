// lib/ogImage.tsx
//
// Shared renderer for the site's social-share image (Open Graph + Twitter).
// Used by app/opengraph-image.tsx and app/twitter-image.tsx via the Next.js
// file-based metadata convention, so both og:image and twitter:image resolve
// to the same generated 1200×630 card — no static PNG to maintain.
//
// Uses only inline styles + system fonts (no external font fetch) to keep the
// image route dependency-free and fast to render.

import { ImageResponse } from "next/og";

export const OG_ALT =
    "Randy Rafael — Fullstack Developer & System Builder";
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

// Brand tokens mirrored from styles/theme.scss (dark theme)
const BG = "#0e0f11";
const BG_2 = "#16181c";
const ACCENT = "#c9a86c";
const TEXT = "#e8eaf0";
const MUTED = "#9da3b0";

export function renderOgImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: "80px",
                    backgroundColor: BG,
                    backgroundImage: `radial-gradient(1000px 500px at 78% -10%, rgba(201,168,108,0.16), transparent 60%), linear-gradient(160deg, ${BG} 0%, ${BG_2} 100%)`,
                    fontFamily: "Arial, sans-serif",
                }}
            >
                {/* Top — eyebrow label */}
                <div style={{ display: "flex", alignItems: "center" }}>
                    <div
                        style={{
                            width: "36px",
                            height: "3px",
                            backgroundColor: ACCENT,
                            marginRight: "18px",
                        }}
                    />
                    <span
                        style={{
                            fontSize: "24px",
                            letterSpacing: "0.28em",
                            textTransform: "uppercase",
                            color: ACCENT,
                            fontWeight: 700,
                        }}
                    >
                        Portfolio
                    </span>
                </div>

                {/* Middle — name + tagline */}
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <span
                        style={{
                            fontSize: "104px",
                            fontWeight: 800,
                            color: TEXT,
                            letterSpacing: "-0.03em",
                            lineHeight: 1.02,
                        }}
                    >
                        Randy Rafael
                    </span>
                    <span
                        style={{
                            marginTop: "20px",
                            fontSize: "40px",
                            color: MUTED,
                            letterSpacing: "-0.01em",
                        }}
                    >
                        Fullstack Developer &amp; System Builder
                    </span>
                </div>

                {/* Bottom — domain + tech row */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >
                    <span
                        style={{
                            fontSize: "26px",
                            color: ACCENT,
                            letterSpacing: "0.02em",
                        }}
                    >
                        randyrafael.my.id
                    </span>
                    <span
                        style={{
                            fontSize: "24px",
                            color: MUTED,
                            letterSpacing: "0.04em",
                        }}
                    >
                        Next.js · TypeScript · React · Node.js
                    </span>
                </div>
            </div>
        ),
        { ...OG_SIZE },
    );
}
