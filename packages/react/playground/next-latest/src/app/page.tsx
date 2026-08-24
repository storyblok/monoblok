import { StoryblokPreviewRsc } from "@storyblok/react/client";
import { renderContent } from "@/lib/actions";
import { client } from "@/lib/storyblok";
import { PreviewBanner } from "@/app/components/PreviewBanner";
import { StoryContent } from "@/app/components/StoryContent";
import Header from "@/app/components/Header";

export default async function Home() {
  const { data } = await client.stories.get("react", {
    query: { version: "draft" },
  });
  const story = data?.story;

  if (!story) return <main className="max-w-4xl mx-auto px-4 py-8">Story not found</main>;

  return (
    <main>
      <PreviewBanner />
      <section className="max-w-4xl mx-auto px-4 py-8">
        <Header />
        <StoryblokPreviewRsc renderContent={renderContent}>
          <StoryContent story={story} />
        </StoryblokPreviewRsc>
      </section>
    </main>
  );
}
