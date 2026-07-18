import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname),
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4777',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:4777',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  build: {
    outDir: resolve(__dirname, '../../dist/app/public'),
    emptyOutDir: false,
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: 'mission-control.js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: assetInfo =>
          assetInfo.name?.endsWith('.css')
            ? 'mission-control.css'
            : 'assets/[name]-[hash][extname]',
      },
    },
  },
});
