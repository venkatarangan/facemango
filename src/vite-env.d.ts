/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_MOCK_AI?: string;
  /** Google Analytics measurement id (G-…), supplied by the owner at build time. */
  readonly VITE_GA_ID?: string;
}
