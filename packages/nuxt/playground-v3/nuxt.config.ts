// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['../src/module'],

  storyblok: {
    accessToken: 'OurklwV5XsDJTIE1NJaD2wtt',
    apiOptions: {
      region: '',
    },
    devtools: true,
    enableServerClient: true,
  },

  app: {
    head: {
      script: [{ src: 'https://cdn.tailwindcss.com' }],
    },
  },

  compatibilityDate: '2024-09-18',
});
