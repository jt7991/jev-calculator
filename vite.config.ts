import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { nitro } from 'nitro/vite';

export default defineConfig({
  plugins: [svelte(), nitro()],
  server: { port: 5173 },
});
