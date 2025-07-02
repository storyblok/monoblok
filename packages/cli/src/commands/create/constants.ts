export interface CreateOptions {
  blueprint?: string;
}

export const blueprints = {
  REACT: {
    name: 'React',
    value: 'react',
    template: 'https://github.com/storyblok/blueprint-starter-react',
    location: 'https://localhost:5173/',
  },
  VUE: {
    name: 'Vue',
    value: 'vue',
    template: 'https://github.com/storyblok/blueprint-starter-vue',
    location: 'https://localhost:5173/',
  },
  SVELTE: {
    name: 'Svelte',
    value: 'svelte',
    template: 'https://github.com/storyblok/blueprint-starter-svelte',
    location: 'https://localhost:5173/',
  },
  ASTRO: {
    name: 'Astro',
    value: 'astro',
    template: 'https://github.com/storyblok/blueprint-starter-astro',
    location: 'https://localhost:4321/',
  },
  NUXT: {
    name: 'Nuxt',
    value: 'nuxt',
    template: 'https://github.com/storyblok/blueprint-starter-nuxt',
    location: 'https://localhost:3000/',
  },
  NEXT: {
    name: 'Next',
    value: 'next',
    template: 'https://github.com/storyblok/blueprint-starter-next',
    location: 'https://localhost:3000/',
  },
  ELEVENTY: {
    name: 'Eleventy',
    value: 'eleventy',
    template: 'https://github.com/storyblok/blueprint-starter-eleventy',
    location: 'https://localhost:8080/',
  },
} as const;
