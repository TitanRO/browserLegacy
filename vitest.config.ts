/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tools/',
        'src/Vendors/',
        '**/*.d.ts',
        'test/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'Utils': resolve(__dirname, 'src/Utils'),
      'Core': resolve(__dirname, 'src/Core'),
      'UI': resolve(__dirname, 'src/UI'),
      'Engine': resolve(__dirname, 'src/Engine'),
      'Renderer': resolve(__dirname, 'src/Renderer'),
      'Controls': resolve(__dirname, 'src/Controls'),
      'DB': resolve(__dirname, 'src/DB'),
      'Loaders': resolve(__dirname, 'src/Loaders'),
      'Network': resolve(__dirname, 'src/Network'),
      'Audio': resolve(__dirname, 'src/Audio'),
      'Plugins': resolve(__dirname, 'src/Plugins'),
      'Preferences': resolve(__dirname, 'src/Preferences'),
      'App': resolve(__dirname, 'src/App'),
    },
  },
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __VERSION__: JSON.stringify('test'),
  },
});