import { apiClient } from "@/lib/storyblok";
import PreviewBanner from "@/app/components/PreviewBanner";
import { StoryblokPreviewRsc } from "@storyblok/react/client";
import { renderContent } from "@/lib/actions";
import { StoryContent } from "@/app/components/StoryContent";

type Params = Promise<{ slug?: string[] }>;

export default async function CatchAllPage({ params }: { params: Params }) {
  const { slug } = await params;
  const storySlug = slug ? slug.join("/") : "react";
  const storyPromise = apiClient.stories.get(storySlug, {
    query: { version: "draft" },
  });
  return <PageContent storyPromise={storyPromise} />;
}

async function PageContent({
  storyPromise,
}: {
  storyPromise: ReturnType<typeof apiClient.stories.get>;
}) {
  const { data } = await storyPromise;
  const story = data?.story;

  if (!story) {
    return <main>Story not found</main>;
  }

  const content = <StoryContent story={story} />;

  return (
    <>
      <PreviewBanner />
      <StoryblokPreviewRsc renderContent={renderContent}>{content}</StoryblokPreviewRsc>
    </>
  );
}
