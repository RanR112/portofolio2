/**
 * BarLayer.tsx
 *
 * Performance contract
 * ─────────────────────
 * Both props are React refs — their object identity never changes after mount.
 * React.memo therefore guarantees this component re-renders ZERO times after
 * the initial mount, regardless of what Piano (its parent) is doing.
 *
 * The animation loop lives entirely in usePianoEngine and manipulates the
 * canvas node directly via canvasRef — no React state or props are involved
 * in the animation path.
 */

import React from "react";
import styles from "./BarLayer.module.scss";

interface BarLayerProps {
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    vizAreaRef: React.RefObject<HTMLDivElement | null>;
}

const BarLayer = React.memo(function BarLayer({
    canvasRef,
    vizAreaRef,
}: BarLayerProps) {
    return (
        <div className={styles.vizArea} ref={vizAreaRef}>
            <canvas className={styles.vizCanvas} ref={canvasRef} />
        </div>
    );
});

export default BarLayer;
