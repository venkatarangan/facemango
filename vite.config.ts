/// <reference types="vitest/config" />
import { copyFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

/**
 * Content-Security-Policy, shipped as a <meta> tag because GitHub Pages cannot set headers.
 * Allowed third parties (SPEC §7): Hugging Face (model weights) and Google Analytics (page views).
 * Build-only: the Vite dev server relies on inline scripts for HMR.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://www.google-analytics.com https://www.googletagmanager.com",
  "font-src 'self'",
  [
    "connect-src 'self'",
    'https://huggingface.co https://*.huggingface.co https://*.hf.co',
    'https://www.google-analytics.com https://*.google-analytics.com',
    'https://*.analytics.google.com https://www.googletagmanager.com',
  ].join(' '),
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

function cspMeta(): Plugin {
  return {
    name: 'facemango:csp-meta',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
        injectTo: 'head-prepend',
      },
    ],
  };
}

/** GitHub Pages SPA fallback: unknown paths are served 404.html, which boots the app. */
function spaFallback(): Plugin {
  let outDir = 'dist';
  return {
    name: 'facemango:spa-404',
    apply: 'build',
    configResolved: (config) => {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle: async () => {
      await copyFile(path.join(outDir, 'index.html'), path.join(outDir, '404.html'));
    },
  };
}

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    cspMeta(),
    spaFallback(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.svg'],
      manifest: {
        name: 'FaceMango',
        short_name: 'FaceMango',
        description: 'The most personal social network ever built. And the most private.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FFFFFF',
        theme_color: '#FFFFFF',
        categories: ['social', 'entertainment', 'lifestyle'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // WebLLM (~6 MB) is only needed on the WebGPU tier; it is cached at runtime instead.
        globIgnores: ['**/assets/webllm*.js'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // Photo pack and emoji load lazily and stay available offline once seen (SPEC §4.5).
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /^\/(photos|emoji)\//.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'facemango-media',
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /^\/assets\/webllm.*\.js$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'facemango-webllm', expiration: { maxEntries: 6 } },
          },
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/models/'),
            handler: 'CacheFirst',
            options: { cacheName: 'facemango-model-libs', expiration: { maxEntries: 8 } },
          },
        ],
      },
    }),
  ],
  test: {
    // Node by default (fast); component tests opt into jsdom with a docblock.
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // /mnt/c (WSL) is slow to start many workers; a few threads are faster and reliable.
    pool: 'threads',
    maxWorkers: 3,
    isolate: false,
    css: false,
  },
});
