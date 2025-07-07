export interface CreateOptions {
  blueprint?: string;
  skipSpace?: boolean;
}

export const blueprints = {
  REACT: {
    name: 'React',
    value: 'react',
    template: 'https://github.com/storyblok/blueprint-core-react',
    location: 'https://localhost:5173/',
  },
  VUE: {
    name: 'Vue',
    value: 'vue',
    template: 'https://github.com/storyblok/blueprint-core-vue',
    location: 'https://localhost:5173/',
  },
  SVELTE: {
    name: 'Svelte',
    value: 'svelte',
    template: 'https://github.com/storyblok/blueprint-core-svelte',
    location: 'https://localhost:5173/',
  },
  ASTRO: {
    name: 'Astro',
    value: 'astro',
    template: 'https://github.com/storyblok/blueprint-core-astro',
    location: 'https://localhost:4321/',
  },
  NUXT: {
    name: 'Nuxt',
    value: 'nuxt',
    template: 'https://github.com/storyblok/blueprint-core-nuxt',
    location: 'https://localhost:3000/',
  },
  NEXT: {
    name: 'Next',
    value: 'next',
    template: 'https://github.com/storyblok/blueprint-core-next',
    location: 'https://localhost:3000/',
  },
  ELEVENTY: {
    name: 'Eleventy',
    value: 'eleventy',
    template: 'https://github.com/storyblok/blueprint-core-eleventy',
    location: 'https://localhost:8080/',
  },
} as const;

/**
 * Interface for dynamic blueprints
 */
export interface DynamicBlueprint {
  name: string;
  value: string;
  template: string;
  location: string;
  description?: string | null;
  updated_at?: string;
}
