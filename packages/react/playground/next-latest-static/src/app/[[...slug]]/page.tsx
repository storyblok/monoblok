import { apiClient, StoryblokComponent } from "@/lib/storyblok";
import Link from "next/link";

export function generateStaticParams() {
  return [{ slug: [] }, { slug: ["react"] }, { slug: ["react", "richtext"] }];
}

export default async function CatchAllPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const storySlug = slug?.join("/") || "react";
  const result = await apiClient.stories.get(storySlug, { query: { version: "draft" } });
  const story = result.data?.story;

  if (!story) return <div>Story not found.</div>;

  return (
    <main>
      <h1>
        {storySlug === "react/richtext"
          ? "Rich Text Example"
          : "Storyblok Next.js Static Export Example"}
      </h1>
      <Link href={storySlug === "react/richtext" ? "/" : "/react/richtext"}>
        {storySlug === "react/richtext" ? "Go to Home" : "Go to Rich Text Example"}
      </Link>
      <StoryblokComponent block={story.content} />
    </main>
  );
}
