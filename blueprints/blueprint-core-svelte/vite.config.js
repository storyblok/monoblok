import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import adapter from '@sveltejs/adapter-auto';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import mkcert from 'vite-plugin-mkcert';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const projectRoot = dirname(fileURLToPath(import.meta.url));
	const env = loadEnv(mode, projectRoot, 'STORYBLOK_');
	return {
		plugins: [
			sveltekit({
				// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
				// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
				// See https://svelte.dev/docs/kit/adapters for more information about adapters.
				adapter: adapter(),
			}),
			mkcert(),
		],
		define: {
			'import.meta.env.STORYBLOK_DELIVERY_API_TOKEN': JSON.stringify(
				env.STORYBLOK_DELIVERY_API_TOKEN,
			),
			'import.meta.env.STORYBLOK_API_BASE_URL': JSON.stringify(
				env.STORYBLOK_API_BASE_URL,
			),
			'import.meta.env.STORYBLOK_REGION': JSON.stringify(env.STORYBLOK_REGION),
		},
	};
});
