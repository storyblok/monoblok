import { client } from "@/lib/storyblok";
import { StoryPage } from "@/components/StoryPage";

export default async function Home() {
  const { data } = await client.stories.get("home", { query: { version: "draft" } });

  if (!data.story) return <div>Story not found</div>;

  return <StoryPage story={data.story} />;
}
