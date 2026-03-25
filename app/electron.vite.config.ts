import path from 'node:path';

import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

const aliases = {
  '@': path.resolve(__dirname, 'src/renderer/src'),
  '@lightfolio/core': path.resolve(__dirname, '../core/src'),
  '@lightfolio/shared': path.resolve(__dirname, '../shared/src')
};

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: aliases
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: aliases
    }
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: aliases
    }
  }
});
