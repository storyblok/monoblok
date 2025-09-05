import { createApp } from 'vue';
import { apiPlugin, StoryblokVue } from '@storyblok/vue';

import './style.css';
import App from './App.vue';
import { router } from './router';
import IframeEmbed from './components/IFrameEmbed.vue';
import CustomBlok from './components/CustomBlok.vue';
import EmojiRandomizer from './components/EmojiRandomizer.vue';

createApp(App)
  .component('iframe-embed', IframeEmbed)
  .component('custom-blok', CustomBlok)
  .component('emoji-randomizer', EmojiRandomizer)
  .use(router)
  .use(StoryblokVue, {
    accessToken: import.meta.env.VITE_STORYBLOK_TOKEN,
    use: [apiPlugin],
  })
  .mount('#app');
