import { createApp } from 'vue';
import { StoryblokVue, apiPlugin } from '@storyblok/vue';
import { createWebHistory, createRouter } from 'vue-router';
import App from './App.vue';
import Page from './components/Page.vue';
import Teaser from './components/Teaser.vue';
import Grid from './components/Grid.vue';
import Feature from './components/Feature.vue';
import PageView from './PageView.vue';

const routes = [{ path: '/:slug*', component: PageView }];

const router = createRouter({
	history: createWebHistory(),
	routes,
});

const app = createApp(App);
app.use(StoryblokVue, {
	accessToken: import.meta.env.STORYBLOK_DELIVERY_API_TOKEN,
	apiOptions: {
		/** Set the correct region for your space. Learn more: https://www.storyblok.com/docs/packages/storyblok-js */
		region: import.meta.env.STORYBLOK_REGION || 'eu',
		/** The following code is only required when creating a Storyblok space directly via the Blueprints feature. */
		endpoint: import.meta.env.STORYBLOK_API_BASE_URL
			? `${new URL(import.meta.env.STORYBLOK_API_BASE_URL).origin}/v2`
			: undefined,
	},
	use: [apiPlugin],
});

app.component('Page', Page);
app.component('Teaser', Teaser);
app.component('Grid', Grid);
app.component('Feature', Feature);
app.use(router).mount('#app');
