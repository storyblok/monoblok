import type { StoryblokRichTextInput } from "@storyblok/react";
import { client, StoryblokRichText } from "@/lib/storyblok";

export default async function RichtextPage() {
  const { data } = await client.stories.get("richtext", { query: { version: "draft" } });
  const story = data?.story;
  const richText = story?.content?.richText as StoryblokRichTextInput | undefined;

  if (!story?.content) {
    return (
      <div className="flex min-h-screen items-center justify-center text-lg text-gray-600 dark:text-gray-400">
        Loading content...
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 prose prose-lg dark:prose-invert">
      <h1 className="mb-8 text-3xl font-bold">Rich Text Example</h1>
      {richText ? (
        <StoryblokRichText document={richText} />
      ) : (
        <p className="text-gray-600 dark:text-gray-400">No content available</p>
      )}
    </div>
  );
}
