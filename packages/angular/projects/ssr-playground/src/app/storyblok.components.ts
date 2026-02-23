import { type StoryblokComponentsMap } from '@storyblok/angular';

/**
 * Registry of Storyblok components with lazy loading.
 * Components are loaded on-demand when first used, reducing initial bundle size.
 *
 * The key should match the component name in Storyblok.
 */
export const storyblokComponents: StoryblokComponentsMap = {
  page: () => import('./components/page/page').then((m) => m.PageComponent),
  teaser: () => import('./components/teaser/teaser').then((m) => m.TeaserComponent),
  grid: () => import('./components/grid/grid').then((m) => m.GridComponent),
  feature: () => import('./components/feature/feature').then((m) => m.FeatureComponent),
  feature_posts: () =>
    import('./components/feature-posts/feature-posts').then((m) => m.FeaturePostsComponent),
};
