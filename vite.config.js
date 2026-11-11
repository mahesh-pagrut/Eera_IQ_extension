import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const projectRoot = new URL('.', import.meta.url);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('index.html', projectRoot)),
        serviceWorker: fileURLToPath(
          new URL('src/background/serviceWorker.js', projectRoot),
        ),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'serviceWorker'
            ? 'background/serviceWorker.js'
            : 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
