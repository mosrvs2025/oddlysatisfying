import { defineConfig } from 'vite';
// Library build: one IIFE file exposing window.Terrarium.mount, inlined into Swirl Room by scripts/build.sh.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', target: 'es2022', lib: { entry: 'src/main.ts', name: 'Terrarium', formats: ['iife'], fileName: () => 'terrarium.js' } },
});
