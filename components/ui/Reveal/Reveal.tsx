"use client";

// components/ui/Reveal/Reveal.tsx
//
// Lightweight scroll-reveal wrapper (fade + rise on first enter).
//
// Design goals:
//   - Progressive enhancement: the server renders content VISIBLE. The hidden
//     state is only applied by JS after mount (the `armed` class), so no-JS
//     users and crawlers always see the content.
//   - Accessible: honours prefers-reduced-motion — reveal is skipped entirely.
//   - Cheap: a single IntersectionObserver per instance, disconnected once the
//     element has appeared. Animates only opacity/transform (GPU-friendly).

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./Reveal.module.scss";

type RevealProps = {
    children: ReactNode;
    /** Stagger delay in ms applied to the transition. */
    delay?: number;
    className?: string;
};

export default function Reveal({
    children,
    delay = 0,
    className = "",
}: RevealProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [armed, setArmed] = useState(false);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const prefersReduced = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        ).matches;

        // Reduced motion or no observer support → show immediately, no arming.
        if (prefersReduced || typeof IntersectionObserver === "undefined") {
            setVisible(true);
            return;
        }

        // Apply the hidden state only now (post-hydration) so SSR stays visible.
        setArmed(true);

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const classes = [
        styles.reveal,
        armed ? styles.armed : "",
        visible ? styles.visible : "",
        className,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div
            ref={ref}
            className={classes}
            style={delay ? { transitionDelay: `${delay}ms` } : undefined}
        >
            {children}
        </div>
    );
}
