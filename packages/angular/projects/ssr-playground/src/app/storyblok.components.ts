import { type StoryblokComponentsMap } from '@storyblok/angular';

/**
 * Registry of Storyblok components with lazy loading.
 * Components are loaded on-demand when first used, reducing initial bundle size.
 *
 * The key should match the component name in Storyblok.
 */
export const storyblokComponents: StoryblokComponentsMap = {
  page: () => import('./components/page/page').then((m) => m.PageComponent),
};
