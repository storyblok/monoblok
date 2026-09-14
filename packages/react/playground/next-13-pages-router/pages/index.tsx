import type { GetStaticProps } from "next";
import { StoryblokPreview, type Story } from "@storyblok/react";
import { apiClient, StoryblokComponent } from "../lib/storyblok";

interface Props {
  story: Story;
}

export default function Home({ story }: Props) {
  return (
    <StoryblokPreview
      story={story}
      renderContent={(live) => <StoryblokComponent block={live.content} />}
    />
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
