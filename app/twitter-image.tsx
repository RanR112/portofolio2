// app/twitter-image.tsx
// File-based Twitter card image — shares the same renderer as the OG image.
import { renderOgImage, OG_ALT, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/ogImage";

export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function TwitterImage() {
    return renderOgImage();
}
