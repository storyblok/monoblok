import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, Routes } from "@angular/router";
import { StoryblokService } from "@storyblok/angular";

const resolveStory = async (slug: string) => {
  const client = inject(StoryblokService).getClient();
  const { data } = await client.stories.get(slug, {
    query: {
      version: "draft",
      resolve_relations: "featured-articles.articles,article.author",
    },
  });
  return data?.story;
};

const livePreviewRoute = {
  title: "Angular Live Preview QA",
  loadComponent: () =>
    import("./routes/live-preview/live-preview.component").then((m) => m.LivePreviewComponent),
  resolve: { story: () => resolveStory("live-preview") },
};

export const routes: Routes = [
  {
    path: "",
    ...livePreviewRoute,
  },
  {
    path: "angular/integration-tests/live-preview",
    ...livePreviewRoute,
  },
  {
    path: "live-preview",
    ...livePreviewRoute,
  },
  {
    path: "**",
    title: "Angular Integration Tests",
    loadComponent: () => import("./routes/story/story.component").then((m) => m.StoryComponent),
    resolve: {
      story: async (route: ActivatedRouteSnapshot) => {
        const slug = route.url.map((segment) => segment.path).join("/") || "home";
        return resolveStory(slug.startsWith("angular/") ? slug : `angular/${slug}`);
      },
    },
  },
];
