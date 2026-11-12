import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';
import { fileURLToPath } from 'node:url';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'STORYBLOK_');
	return {
		plugins: [react(), mkcert()],
		define: {
			'import.meta.env.STORYBLOK_DELIVERY_API_TOKEN': JSON.stringify(
				env.STORYBLOK_DELIVERY_API_TOKEN,
			),
			'import.meta.env.STORYBLOK_REGION': JSON.stringify(env.STORYBLOK_REGION),
			'import.meta.env.STORYBLOK_API_BASE_URL': JSON.stringify(
				env.STORYBLOK_API_BASE_URL,
			),
		},
	};
});
