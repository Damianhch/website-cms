import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { existsSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  base: '/admin/',
  plugins: [
    react(),
    {
      name: 'rename-admin-index',
      closeBundle() {
        const from = path.join(root, 'admin-dist', 'admin-index.html');
        const to = path.join(root, 'admin-dist', 'index.html');
        if (existsSync(from)) renameSync(from, to);
      },
    },
  ],
  build: {
    outDir: path.join(root, 'admin-dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.join(root, 'admin-index.html'),
    },
  },
});
