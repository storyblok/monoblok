import { Suspense } from "react";
import { StoryblokPreview } from "@storyblok/react/rsc";
import { apiClient } from "@/lib/storyblok";
import { renderContent } from "@/lib/actions";
import SlowWidget from "@/components/slow-widget";

type Params = Promise<{ slug?: string[] }>;

export default async function CatchAllPage({ params }: { params: Params }) {
  const { slug } = await params;
  const storySlug = slug?.length ? slug.join("/") : "home";

  const result = await apiClient.stories.get(storySlug, {
    query: { version: "draft", resolve_relations: "featured-articles.posts" },
  });
  const story = result.data?.story;
  if (!story) return <div>Failed to load story.</div>;
  if (story.content?.component !== "page") return <div>Unsupported story.</div>;

  return (
    <div>
      <StoryblokPreview
        story={story}
        bridgeOptions={{ resolveRelations: ["featured-articles.posts"] }}
        renderContent={renderContent}
      />
      {/*
        Bridge-disabled, on purpose: renders the story fetched on request
        directly, never through `StoryblokPreview`, so it never subscribes to
        editor events. Proves the bridge is opt-in per call, not a page-wide
        default — an editor `input` event has no subscription to replace here.
        Mirrors the client playground's static assertion so the same
        Playwright spec can check it on both.
      */}
      {story.content.body?.map((block) =>
        block.component === "teaser" ? (
          <p key={block._uid} data-test="static-teaser-headline">
            {block.headline}
          </p>
        ) : null,
      )}
      {/*
        Not a Storyblok component — a plain async Server Component standing
        in for a genuinely slow data source. Proves the page streams this
        fallback immediately instead of blocking on it, and that the
        live-editing bridge above keeps working on the rest of the tree while
        this is still pending.
      */}
      <Suspense fallback={<div data-test="slow-widget-fallback">Loading widget…</div>}>
        <SlowWidget />
      </Suspense>
    </div>
  );
}
