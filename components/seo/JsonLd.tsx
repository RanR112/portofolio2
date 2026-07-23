// components/seo/JsonLd.tsx
//
// Renders a JSON-LD structured-data <script>. Server-safe (no "use client").
// Pass a single schema object or an array; it is serialized as-is.

export default function JsonLd({
    data,
}: {
    data: Record<string, unknown> | Record<string, unknown>[];
}) {
    return (
        <script
            type="application/ld+json"
            // Structured data is trusted, author-controlled content — safe to inline.
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
    );
}
