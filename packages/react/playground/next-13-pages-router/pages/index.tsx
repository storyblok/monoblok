import type { GetStaticProps } from "next";
import { StoryblokPreview, type Story } from "@storyblok/react";
import { apiClient, StoryblokBlock } from "../lib/storyblok";

interface Props {
  story: Story;
}

export default function Home({ story }: Props) {
  return (
    <StoryblokPreview
      story={story}
      renderContent={(live) => <StoryblokBlock block={live.content} />}
    />
  );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  const result = await apiClient.stories.get("react", { query: { version: "draft" } });
  // Only a 404 means the story is missing. Rethrow any other failure so a
  // transient CMS error keeps the last good page instead of caching a 404.
  if (result.error?.response.status === 404) return { notFound: true };
  if (result.error) throw result.error;

  return {
    props: { story: result.data.story },
    revalidate: 3600,
  };
};
