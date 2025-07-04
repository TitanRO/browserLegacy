/// <reference types="vite/client" />

// Global constants defined in vite.config.js
declare const __BUILD_DATE__: string;
declare const __VERSION__: string;

// For dynamic imports in modules
interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  // Add more env variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}