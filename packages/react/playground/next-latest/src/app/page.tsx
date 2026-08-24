import type { Story } from "@storyblok/react";
import { StoryblokPreviewRsc } from "@storyblok/react/client";
import Link from "next/link";
import { client, StoryblokComponent } from "@/lib/storyblok";

export default async function Home() {
  const { data } = await client.get("cdn/stories/react", { version: "draft" });
  const story = data.story as Story | undefined;

  async function renderContent(updatedStory: Story) {
    "use server";
    return <StoryblokComponent block={updatedStory.content} />;
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto prose">
        <h1 className="text-4xl font-bold mb-8 dark:text-white">Storyblok Next.js 16 Example</h1>
        <nav className="mb-8 space-y-4">
          <Link
            href="/react/richtext"
            className="block rounded-lg bg-blue-500 p-4 text-white transition-colors hover:bg-blue-600"
          >
            Go to Rich Text Example
          </Link>
        </nav>
        {story && (
          <StoryblokPreviewRsc renderContent={renderContent}>
            <StoryblokComponent block={story.content} />
          </StoryblokPreviewRsc>
        )}
      </div>
    </main>
  );
}
