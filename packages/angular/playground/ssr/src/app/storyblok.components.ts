import { SbAngularRichTextComponentMap, type StoryblokComponentsMap } from '@storyblok/angular';

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
  'featured-articles': () =>
    import('./components/feature-posts/feature-posts').then((m) => m.FeaturePostsComponent),
  'article-overview': () =>
    import('./components/article-overview/article-overview.component').then(
      (m) => m.ArticleOverviewComponent,
    ),
  article: () => import('./components/article/article.component').then((m) => m.ArticleComponent),
};

export const storyblokRichtextComponents: SbAngularRichTextComponentMap = {
  image: () => import('./components/richtext/image.component').then((m) => m.ImageComponent),
  link: () => import('./components/richtext/link.component').then((m) => m.LinkComponent),
  heading: () => import('./components/richtext/heading.component').then((m) => m.HeadingComponent),
  table: () => import('./components/richtext/table.component').then((m) => m.TableComponent),
};
