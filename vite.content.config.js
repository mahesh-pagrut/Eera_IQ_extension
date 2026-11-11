import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const projectRoot = new URL('.', import.meta.url);

export default defineConfig({
  configFile: false,
  root: fileURLToPath(projectRoot),
  plugins: [react(), tailwindcss()],
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: fileURLToPath(new URL('src/content/contentScript.jsx', projectRoot)),
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'content/contentScript.js',
      },
    },
  },
});
