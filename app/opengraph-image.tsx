// app/opengraph-image.tsx
// File-based Open Graph image — applies to all routes that don't override it.
import { renderOgImage, OG_ALT, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/ogImage";

export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpengraphImage() {
    return renderOgImage();
}
