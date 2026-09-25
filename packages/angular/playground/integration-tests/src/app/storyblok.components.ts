import {
  type StoryblokAngularRichTextComponentMap,
  type StoryblokComponentsMap,
} from "@storyblok/angular";

export const storyblokComponents: StoryblokComponentsMap = {
  page: () => import("./components/page/page.component").then((m) => m.PageComponent),
  article: () => import("./components/article/article.component").then((m) => m.ArticleComponent),
  "featured-articles": () =>
    import("./components/featured-articles/featured-articles.component").then(
      (m) => m.FeaturedArticlesComponent,
    ),
};

export const storyblokRichtextComponents: StoryblokAngularRichTextComponentMap = {};
