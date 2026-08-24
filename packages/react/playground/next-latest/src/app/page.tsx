import { StoryblokPreviewRsc } from "@storyblok/react/client";
import Link from "next/link";
import { renderContent } from "@/lib/actions";
import { client, isPreview } from "@/lib/storyblok";
import { PreviewBanner } from "@/app/components/PreviewBanner";
import { StoryContent } from "@/app/components/StoryContent";

export default async function Home() {
  const { data } = await client.stories.get("react", {
    query: { version: isPreview ? "draft" : "published" },
  });
  const story = data?.story;

  return (
    <main className="container mx-auto px-4 py-8">
      {isPreview && <PreviewBanner />}
      <div className="max-w-4xl mx-auto prose">
        <h1 className="mb-8 text-4xl font-bold dark:text-white">Storyblok Next.js 16 Example</h1>
        <nav className="mb-8 space-y-4">
          <Link
            href="/react/richtext"
            className="block rounded-lg bg-blue-500 p-4 text-white transition-colors hover:bg-blue-600"
          >
            Go to Rich Text Example
          </Link>
        </nav>
        {story &&
          (isPreview ? (
            <StoryblokPreviewRsc renderContent={renderContent}>
              <StoryContent story={story} />
            </StoryblokPreviewRsc>
          ) : (
            <StoryContent story={story} />
          ))}
      </div>
    </main>
  );
}
