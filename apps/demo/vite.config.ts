import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [tailwind(), react()],
  resolve: {
    alias: {
      '@webpacked-timeline/ui/styles/davinci': path.resolve(__dirname, '../../packages/ui/src/davinci.css'),
      '@webpacked-timeline/ui/styles/tokens': path.resolve(__dirname, '../../packages/ui/src/tokens.css'),
      '@webpacked-timeline/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
      '@webpacked-timeline/core': path.resolve(__dirname, '../../packages/core/src/public-api.ts'),
      '@webpacked-timeline/react': path.resolve(__dirname, '../../packages/react/src/index.ts'),
    },
  },
});
