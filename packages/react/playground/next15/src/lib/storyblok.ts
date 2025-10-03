import EmojiRandomizer from '@/app/components/EmojiRandomizer';
import Grid from '@/app/components/Grid';
import Page from '@/app/components/Page';
import Teaser from '@/app/components/Teaser';
import { apiPlugin, storyblokInit } from '@storyblok/react/rsc';

export const getStoryblokApi = storyblokInit({
  accessToken: 'OurklwV5XsDJTIE1NJaD2wtt',
  apiOptions: {
    endpoint: process.env.STORYBLOK_API_ENDPOINT,
  },
  use: [apiPlugin],
  components: {
    'teaser': Teaser,
    'page': Page,
    'grid': Grid,
    'emoji-randomizer': EmojiRandomizer,
  },
});
