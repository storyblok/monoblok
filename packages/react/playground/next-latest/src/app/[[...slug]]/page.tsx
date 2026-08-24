import { Suspense } from "react";
import { StoryblokPreviewRsc } from "@storyblok/react/client";
import { renderContent } from "@/lib/actions.tsx";
import { client, isPreview } from "@/lib/storyblok";
import { PreviewBanner } from "@/app/components/PreviewBanner";
import { StoryContent } from "@/app/components/StoryContent";

type Params = Promise<{ slug?: string[] }>;

/**
 * Optional catch-all route — handles every URL in the app.
 *
 * slug segments   → Storyblok story slug
 * /               → undefined          → "home"
 * /about          → ["about"]          → "about"
 * /blog/my-post   → ["blog","my-post"] → "blog/my-post"
 *
 * In Next.js 16 `params` is a Promise, so slug access is pushed inside
 * a <Suspense> boundary to keep the outer component sync (static shell).
 * PageContent then suspends for the Storyblok fetch.
 */
export default function CatchAllPage({ params }: { params: Params }) {
  return (
    <Suspense>
      {params.then(({ slug }) => {
        const storySlug = slug?.join("/") ?? "home";
        const storyPromise = client.stories.get(storySlug, {
          query: { version: isPreview ? "draft" : "published" },
        });
        return <PageContent storyPromise={storyPromise} />;
      })}
    </Suspense>
  );
}

async function PageContent({
  storyPromise,
}: {
  storyPromise: ReturnType<typeof client.stories.get>;
}) {
  const { data } = await storyPromise;
  const story = data?.story;

  if (!story) {
    return <main>Story not found</main>;
  }

  const content = <StoryContent story={story} />;

  if (!isPreview) {
    return content;
  }

  return (
    <>
      <PreviewBanner />
      <StoryblokPreviewRsc renderContent={renderContent}>{content}</StoryblokPreviewRsc>
    </>
  );
}
