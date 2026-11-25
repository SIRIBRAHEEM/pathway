import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' keeps asset paths relative so the built site works from any
// static host or subfolder, including GitHub Pages project sites.
export default defineConfig({
  plugins: [react()],
  base: './',
});
