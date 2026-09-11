"use client";

// components/ui/KineticText/KineticText.tsx
//
// [BARU — kinetic-console, Step 2]
// Nama/judul hero dimainkan per-karakter, seperti nada dimainkan berurutan —
// bagian dari arah desain 03 Kinetic Console (.claude/examples/03-kinetic-console).
// Dipakai oleh SectionWrapper saat size="hero" (lihat SectionWrapper.tsx).
//
// Pola aman yang diikuti (sama seperti components/ui/Reveal/Reveal.tsx):
//   - SSR & fallback SELALU render teks polos yang utuh dan terlihat (opacity:1,
//     satu node teks) — no-JS, crawler, dan first paint tidak pernah melihat
//     apa pun yang tersembunyi.
//   - Animasi baru "dipasang" (armed) setelah mount, dan HANYA jika
//     prefers-reduced-motion tidak aktif. `motion` adalah animasi JS
//     (requestAnimationFrame), bukan CSS transition/animation — jadi kill-switch
//     CSS global di globals.scss TIDAK menyentuhnya sama sekali. Guard ini
//     wajib eksplisit di sini.
//   - Screen reader membaca satu string utuh lewat aria-label pada wrapper;
//     tiap span karakter individual diberi aria-hidden.

import { useEffect, useState } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import styles from "./KineticText.module.scss";

type KineticTextProps = {
    text: string;
    className?: string;
};

const containerVariants: Variants = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: 0.045,
            delayChildren: 0.05,
        },
    },
};

const charVariants: Variants = {
    hidden: { opacity: 0, y: 22 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { type: "spring", stiffness: 260, damping: 24 },
    },
};

export default function KineticText({ text, className }: KineticTextProps) {
    const prefersReducedMotion = useReducedMotion();
    const [armed, setArmed] = useState(false);

    useEffect(() => {
        // Hanya "memasang" versi animasi setelah mount, dan hanya kalau
        // reduced-motion tidak aktif. Selama itu (termasuk render SSR di
        // atas), teks polos yang tampil — aman secara default.
        if (!prefersReducedMotion) setArmed(true);
    }, [prefersReducedMotion]);

    if (!armed) {
        return <span className={className}>{text}</span>;
    }

    const chars = Array.from(text);

    return (
        <motion.span
            className={className}
            aria-label={text}
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            style={{ display: "inline-block" }}
        >
            {chars.map((char, index) => (
                <motion.span
                    // eslint-disable-next-line react/no-array-index-key
                    key={index}
                    className={styles.char}
                    variants={charVariants}
                    aria-hidden="true"
                    style={{
                        display: "inline-block",
                        whiteSpace: char === " " ? "pre" : "normal",
                    }}
                >
                    {char}
                </motion.span>
            ))}
        </motion.span>
    );
}
