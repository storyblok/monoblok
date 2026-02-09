export default defineNuxtConfig({
  modules: ['../src/module'],
  storyblok: {
    accessToken: 'OurklwV5XsDJTIE1NJaD2wtt',
    apiOptions: {
      region: '',
    },
    devtools: true,
  },

  app: {
    head: {
      script: [{ src: 'https://cdn.tailwindcss.com' }],
    },
  },

  compatibilityDate: '2025-01-13',
});
