import { type StoryblokComponentsMap } from '@storyblok/angular';

export const storyblokComponents: StoryblokComponentsMap = {
  page: () => import('./components/page/page.component').then((m) => m.PageComponent),
  teaser: () => import('./components/teaser/teaser.component').then((m) => m.TeaserComponent),
  grid: () => import('./components/grid/grid.component').then((m) => m.GridComponent),
  feature: () => import('./components/feature/feature.component').then((m) => m.FeatureComponent),
};