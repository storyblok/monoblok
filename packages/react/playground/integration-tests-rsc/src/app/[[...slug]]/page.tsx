import { Suspense } from "react";
import { type ISbStoryData, StoryblokStory } from "@storyblok/react/rsc";
import SlowWidget from "@/components/slow-widget";
import { getStoryblokApi } from "@/lib/storyblok";

type Params = Promise<{ slug?: string[] }>;

const RESOLVE_RELATIONS = ["featured-articles.posts"];

export default async function CatchAllPage({ params }: { params: Params }) {
  const { slug } = await params;
  const storySlug = slug?.length ? slug.join("/") : "home";

  const { data } = await getStoryblokApi().get(`cdn/stories/${storySlug}`, {
    version: "draft",
    resolve_relations: RESOLVE_RELATIONS.join(","),
  });
  const story: ISbStoryData | undefined = data?.story;
  if (!story) {
    return <div>Failed to load story.</div>;
  }

  return (
    <div>
      <StoryblokStory story={story} bridgeOptions={{ resolveRelations: RESOLVE_RELATIONS }} />
      {/*
        Bridge-disabled, on purpose: renders the fetched story directly, never
        through `StoryblokStory`. It must never change on a live edit, which
        also proves the live edit isn't shared server state.
      */}
      {story.content.body?.map((block: { _uid: string; component: string; headline?: string }) =>
        block.component === "teaser" ? (
          <p key={block._uid} data-test="static-teaser-headline">
            {block.headline}
          </p>
        ) : null,
      )}
      <Suspense fallback={<div data-test="slow-widget-fallback">Loading widget…</div>}>
        <SlowWidget />
      </Suspense>
    </div>
  );
}
