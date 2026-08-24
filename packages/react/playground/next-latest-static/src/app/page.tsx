import Link from "next/link";
import { client, StoryblokComponent } from "@/lib/storyblok";

// Pages are statically generated at build time — no server-side live preview.
export default async function Home() {
  const { data } = await client.stories.get("react", { query: { version: "draft" } });
  const story = data.story;

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto prose">
        <h1 className="text-4xl font-bold mb-8 dark:text-white">
          Storyblok Next.js 16 Static Export Example
        </h1>
        <nav className="mb-8 space-y-4">
          <Link
            href="/react/richtext"
            className="block rounded-lg bg-blue-500 p-4 text-white transition-colors hover:bg-blue-600"
          >
            Go to Rich Text Example
          </Link>
        </nav>
        {story && <StoryblokComponent block={story.content} />}
      </div>
    </main>
  );
}
