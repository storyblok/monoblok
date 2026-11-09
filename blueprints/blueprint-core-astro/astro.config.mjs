import { defineConfig } from 'astro/config';
import mkcert from 'vite-plugin-mkcert';

import vercel from '@astrojs/vercel';
import netlify from '@astrojs/netlify';

export default defineConfig({
	devToolbar: {
		enabled: false,
	},
	output: 'server',
	adapter: process.env.NETLIFY ? netlify() : vercel(),
	vite: {
		plugins: [mkcert()],
	},
});
