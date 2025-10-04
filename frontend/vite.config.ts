import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // Vitest configuration
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },

  // Path aliases matching tsconfig.json
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared/src'),
    },
  },

  // Development server configuration
  server: {
    port: 5175,
    host: true,
    strictPort: false,
    proxy: {
      // Proxy API requests to backend during development
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      // Proxy WebSocket connections to backend
      '/socket.io': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },

  // Preview server configuration (for testing production builds)
  preview: {
    port: 4173,
    strictPort: true,
  },

  // Build configuration
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Optimize bundle size
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor bundle for better caching
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // Separate socket.io bundle
          socketio: ['socket.io-client'],
        },
      },
    },
    // Increase chunk size warning limit for larger assets
    chunkSizeWarningLimit: 1000,
  },

  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'socket.io-client'],
  },
});