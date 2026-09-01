import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: join(root, 'admin'),
  base: '/admin/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: join(root, 'admin-dist'),
    emptyOutDir: true,
    sourcemap: false,
  },
});
