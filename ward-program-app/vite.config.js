// vite.config.js
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],

    // ── Dev server ─────────────────────────────────────────────────────────
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: env.VITE_DEV_PROXY_TARGET ?? 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        },
      },
    },

    // ── Production build optimizations ─────────────────────────────────────
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': [
              'react',
              'react-dom',
              'react-router-dom',
            ],
            'vendor-pdf': [
              'jspdf',
              'jspdf-autotable',  // ← add this, it's currently landing in index
              'html2canvas',
            ],
            'vendor-dnd': [
              '@dnd-kit/core',
              '@dnd-kit/sortable',
              '@dnd-kit/modifiers',
              '@dnd-kit/utilities',
            ],
          },
        },
      },
    },
  };
});