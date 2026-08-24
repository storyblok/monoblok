import { StoryblokPreviewRsc } from "@storyblok/react/client";
import { renderContent } from "@/lib/actions.tsx";
import { client, isPreview } from "@/lib/storyblok";
import { PreviewBanner } from "@/app/components/PreviewBanner";
import { StoryContent } from "@/app/components/StoryContent";

export default async function Home() {
  const { data } = await client.stories.get("react", {
    query: { version: isPreview ? "draft" : "published" },
  });
  const story = data?.story;

  if (!story) return <main>Story not found</main>;

  const content = <StoryContent story={story} />;

  if (!isPreview) return content;

  return (
    <>
      <PreviewBanner />
      <StoryblokPreviewRsc renderContent={renderContent}>{content}</StoryblokPreviewRsc>
    </>
  );
}
