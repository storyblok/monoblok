import { createApp } from 'vue';
import { apiPlugin, StoryblokVue } from '@storyblok/vue';

import './style.css';
import App from './App.vue';
import { router } from './router';
import IframeEmbed from './components/IFrameEmbed.vue';

createApp(App)
  .component('iframe-embed', IframeEmbed)
  .use(router)
  .use(StoryblokVue, {
    accessToken: import.meta.env.VITE_STORYBLOK_TOKEN,
    use: [apiPlugin],
  })
  .mount('#app');
