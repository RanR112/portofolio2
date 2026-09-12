// ─────────────────────────────────────────────────────────────────────────────
// lib/piano/ticker.ts
//
// Sumber jam untuk pemutaran lagu. Dipakai bersama oleh scheduler playback dan
// alat kalibrasi, supaya perbaikan "lagu rusak saat pindah tab" hanya ada di
// SATU tempat.
//
// ── Kenapa bukan requestAnimationFrame ───────────────────────────────────────
//
// Versi pertama alat kalibrasi memakai rAF dan itu rusak begitu user berpindah
// tab: browser MENGHENTIKAN rAF sepenuhnya di tab tersembunyi, sementara jam
// dindingnya terus berjalan. Akibatnya
//   1. tidak ada not yang dipicu                  -> senyap,
//   2. posisi lagu tetap maju di belakang,
//   3. begitu tab dibuka lagi, satu frame memicu SEMUA not yang waktunya sudah
//      lewat                                      -> ledakan not serempak.
//
// Diganti timer di dalam Web Worker. setInterval di main thread di-clamp ke
// >= 1000ms saat tab disembunyikan, sementara timer di dalam Worker tidak —
// itu sebabnya aplikasi metronom/DAW web memakai pola ini. Sudah diuji oleh
// owner: lagu tetap berjalan mulus walau berpindah tab.
//
// Pemanggil WAJIB tetap menangani kemungkinan jam membeku (lihat
// CATCHUP_LIMIT_MS di pemakainya): perilaku throttling beda antar browser dan
// bisa berubah, dan laptop yang sleep tetap membekukan segalanya.
// ─────────────────────────────────────────────────────────────────────────────

/** Periode tick default. 25ms setara rAF 60fps untuk kebutuhan ritme. */
export const TICK_MS = 25;

/**
 * Kalau satu tick melompat lebih jauh dari ini, anggap jam-nya sempat beku
 * (tab di-throttle keras, mesin sibuk, laptop sleep). Pemanggil harus
 * MELEWATI not yang kelewat, bukan membunyikannya menyusul.
 */
export const CATCHUP_LIMIT_MS = 400;

/**
 * Jalankan `onTick` secara berkala, dan tetap jalan walau tab tersembunyi.
 *
 * Mengembalikan fungsi untuk menghentikannya.
 */
export function startTicker(
    onTick: () => void,
    periodMs: number = TICK_MS,
): () => void {
    let stopped = false;
    let ticked = false;
    let worker: Worker | null = null;
    let blobUrl: string | null = null;
    let fallbackId: number | null = null;
    let watchdogId: number | null = null;

    const startFallback = (): void => {
        if (stopped || fallbackId !== null) return;
        fallbackId = window.setInterval(onTick, periodMs);
    };

    const killWorker = (): void => {
        if (worker) {
            try {
                worker.postMessage("stop");
                worker.terminate();
            } catch {
                /* sudah mati */
            }
            worker = null;
        }
        if (blobUrl) {
            URL.revokeObjectURL(blobUrl);
            blobUrl = null;
        }
    };

    try {
        // Worker dibuat dari Blob, bukan file .worker.ts terpisah — tidak perlu
        // konfigurasi bundler apa pun.
        const source = `let id = null;
onmessage = (e) => {
    if (e.data === "stop") { clearInterval(id); id = null; return; }
    clearInterval(id);
    id = setInterval(() => postMessage(0), e.data);
};`;
        blobUrl = URL.createObjectURL(
            new Blob([source], { type: "application/javascript" }),
        );
        worker = new Worker(blobUrl);
        worker.onmessage = () => {
            if (stopped) return;
            if (!ticked) {
                ticked = true;
                if (watchdogId !== null) {
                    window.clearTimeout(watchdogId);
                    watchdogId = null;
                }
            }
            onTick();
        };
        worker.postMessage(periodMs);

        // Worker bisa terbentuk tanpa pernah mengirim tick — misalnya kalau
        // nanti ada CSP yang memblokir worker dari blob:. Tanpa watchdog ini,
        // gejalanya adalah lagu SENYAP TOTAL tanpa satu pun error, yang sulit
        // ditebak penyebabnya. Jadi kalau tick pertama tidak datang, pindah ke
        // setInterval biasa dan katakan alasannya di console.
        watchdogId = window.setTimeout(
            () => {
                watchdogId = null;
                if (ticked || stopped) return;
                console.warn(
                    "[piano] worker timer tidak merespons — jatuh ke setInterval " +
                        "(lagu tetap jalan, tapi bisa tersendat saat tab di belakang)",
                );
                killWorker();
                startFallback();
            },
            Math.max(200, periodMs * 8),
        );
    } catch {
        startFallback();
    }

    return () => {
        stopped = true;
        if (watchdogId !== null) window.clearTimeout(watchdogId);
        if (fallbackId !== null) window.clearInterval(fallbackId);
        killWorker();
    };
}
