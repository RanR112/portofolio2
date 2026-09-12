// ─────────────────────────────────────────────────────────────────────────────
// scripts/_tsHook.mjs
//
// Memungkinkan script dev di folder ini meng-import file .ts project secara
// langsung (lewat type-stripping bawaan Node 22), tanpa menambah TS runner
// sebagai dependency dan tanpa mengubah tsconfig.
//
// Masalah yang ditambal: file .ts di project ini meng-import tetangganya tanpa
// ekstensi ("../keyMap") — gaya yang dipakai seluruh project dan yang diterima
// tsc "moduleResolution: bundler" — sementara resolver ESM Node menuntut
// ekstensi eksplisit. Hook ini mencoba resolusi normal dulu, dan hanya kalau
// gagal ia menambahkan ".ts".
//
// Import modul ini SEBELUM meng-import file .ts apa pun:
//
//   import "./_tsHook.mjs";
//   const { parseTab } = await import("../lib/piano/parseTab.ts");
//
// Import statis di-hoist dan diselesaikan sebelum kode berjalan, jadi file .ts
// harus diambil lewat `await import()` dinamis supaya hook-nya sudah terpasang.
// ─────────────────────────────────────────────────────────────────────────────

import { registerHooks } from "node:module";

registerHooks({
    resolve(specifier, context, nextResolve) {
        try {
            return nextResolve(specifier, context);
        } catch (err) {
            if (
                err?.code === "ERR_MODULE_NOT_FOUND" &&
                specifier.startsWith(".") &&
                !specifier.endsWith(".ts")
            ) {
                return nextResolve(`${specifier}.ts`, context);
            }
            throw err;
        }
    },
});
