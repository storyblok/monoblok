import React from 'react';
import ReactDOM from 'react-dom/client';
import { apiPlugin, storyblokInit } from '@storyblok/react';
import IFrameEmbed from './components/IFrameEmbed.tsx';

import App from './App.tsx';
import './index.css';
import CustomBlok from './components/CustomBlok.tsx';
import EmojiRandomizer from './components/EmojiRandomizer.tsx';

storyblokInit({
  accessToken: import.meta.env.VITE_STORYBLOK_TOKEN,
  use: [apiPlugin],
  components: {
    'iframe-embed': IFrameEmbed,
    'custom-blok': CustomBlok,
    'emoji-randomizer': EmojiRandomizer,
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
