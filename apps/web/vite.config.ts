import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { defineConfig, loadEnv } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');

  const API_TARGET = env.VITE_API_URL ?? 'http://localhost:3000';
  const ALLOWED_HOSTS = env.VITE_ALLOWED_HOSTS?.split(',')
    .map((h) => h.trim())
    .filter(Boolean);

  return {
    plugins: [
      tanstackRouter({ routesDirectory: './src/routes', routeFileIgnorePattern: '\\.test\\.' }),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        strategies: 'generateSW',
        injectRegister: 'auto',
        manifest: false,
        workbox: {
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api/],
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [],
        },
        devOptions: { enabled: false },
      }),
      env.ANALYZE === '1' &&
        visualizer({ open: true, gzipSize: true, filename: 'dist/stats.html' }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      allowedHosts: ALLOWED_HOSTS?.length ? ALLOWED_HOSTS : undefined,
      proxy: {
        '/auth': { target: API_TARGET, changeOrigin: true },
        '/vaults': { target: API_TARGET, changeOrigin: true },
        '/user': { target: API_TARGET, changeOrigin: true },
        '/admin': { target: API_TARGET, changeOrigin: true },
        '/health': { target: API_TARGET, changeOrigin: true },
      },
    },
  };
});
