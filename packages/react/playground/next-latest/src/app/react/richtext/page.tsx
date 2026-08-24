import type { StoryblokRichTextInput } from "@storyblok/react";
import { client, StoryblokRichText } from "@/lib/storyblok";
import { PreviewBanner } from "@/app/components/PreviewBanner";
import Header from "@/app/components/Header";

export default async function RichtextPage() {
  const { data } = await client.stories.get("richtext", { query: { version: "draft" } });
  const story = data?.story;
  const richText = story?.content?.richText as StoryblokRichTextInput | undefined;

  if (!story) return <main className="max-w-4xl mx-auto px-4 py-8">Story not found</main>;

  return (
    <main>
      <PreviewBanner />
      <section className="max-w-4xl mx-auto px-4 py-8">
        <Header />
        {richText ? (
          <div className="prose prose-lg dark:prose-invert">
            <StoryblokRichText document={richText} />
          </div>
        ) : (
          <p className="text-gray-600 dark:text-gray-400">No content available</p>
        )}
      </section>
    </main>
  );
}
