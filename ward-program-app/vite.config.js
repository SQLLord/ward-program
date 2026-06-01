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

    // ── Dep pre-bundling — use esnext so rolldown doesn't try to downcompile
    //    modern syntax in packages like @dnd-kit ──────────────────────────────
    optimizeDeps: {
      rolldownOptions: {
        output: {
          target: 'esnext',
        },
      },
    },

    // ── Production build optimizations ─────────────────────────────────────
    build: {
      target: 'esnext',
      sourcemap: false,
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/node_modules/react') || id.includes('/node_modules/react-dom') || id.includes('/node_modules/react-router-dom')) {
              return 'vendor-react';
            }
            if (id.includes('/node_modules/jspdf') || id.includes('/node_modules/jspdf-autotable') || id.includes('/node_modules/html2canvas')) {
              return 'vendor-pdf';
            }
            if (id.includes('/node_modules/@dnd-kit/')) {
              return 'vendor-dnd';
            }
          },
        },
      },
    },
  };
});