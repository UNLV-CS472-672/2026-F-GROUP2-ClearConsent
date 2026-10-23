import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	// Prebundling these packages creates a second Svelte runtime in dev and breaks table hydration.
	optimizeDeps: { exclude: ['@tanstack/svelte-table', '@tanstack/svelte-store'] }
});
