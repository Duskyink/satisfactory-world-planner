import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds one self-contained index.html so it can be opened by double-clicking,
// dropped on a share, or served by GitHub Pages with no other files.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  build: { assetsInlineLimit: 100000000, cssCodeSplit: false, reportCompressedSize: false },
  server: { host: true, port: 5173 }
});
