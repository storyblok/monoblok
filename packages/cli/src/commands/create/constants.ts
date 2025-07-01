export interface CreateOptions {
  blueprint?: string;
}

export const blueprints = {
  REACT: {
    name: 'React',
    value: 'react',
    template: 'https://github.com/storyblok/blueprint-starter-react',
  },
  VUE: {
    name: 'Vue',
    value: 'vue',
    template: 'https://github.com/storyblok/blueprint-starter-vue',
  },
  SVELTE: {
    name: 'Svelte',
    value: 'svelte',
    template: 'https://github.com/storyblok/blueprint-starter-svelte',
  },
  ASTRO: {
    name: 'Astro',
    value: 'astro',
    template: 'https://github.com/storyblok/blueprint-starter-astro',
  },
  NUXT: {
    name: 'Nuxt',
    value: 'nuxt',
    template: 'https://github.com/storyblok/blueprint-starter-nuxt',
  },
  NEXT: {
    name: 'Next',
    value: 'next',
    template: 'https://github.com/storyblok/blueprint-starter-next',
  },
  ELEVENTY: {
    name: 'Eleventy',
    value: 'eleventy',
    template: 'https://github.com/storyblok/blueprint-starter-eleventy',
  },
} as const;
