import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';
import mkcert from 'vite-plugin-mkcert';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(
		mode,
		fileURLToPath(new URL('.', import.meta.url)),
		'STORYBLOK_',
	);
	return {
		plugins: [mkcert(), vue(), vueDevTools()],
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
