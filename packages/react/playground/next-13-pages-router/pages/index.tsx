import type { GetStaticProps } from "next";
import type { Story } from "@storyblok/react";
import { StoryblokPreview } from "@storyblok/react/client";
import { apiClient, StoryblokComponent } from "../lib/storyblok";

interface Props {
  story: Story;
}

export default function Home({ story }: Props) {
  return (
    <StoryblokPreview story={story}>
      {(live) => <StoryblokComponent block={live.content} />}
    </StoryblokPreview>
  );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  const result = await apiClient.stories.get("react", { query: { version: "draft" } });
  if (!result.data) return { notFound: true };

  return {
    props: { story: result.data.story },
    revalidate: 3600,
  };
};
