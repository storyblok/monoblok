import type { GetStaticProps, InferGetStaticPropsType } from "next";
import type { Story } from "@storyblok/react";
import { StoryblokPreview } from "@storyblok/react/client";
import { client, StoryblokComponent } from "../lib/storyblok";

export default function Home({ story }: InferGetStaticPropsType<typeof getStaticProps>) {
  if (!story) return <div>Loading...</div>;

  return (
    <StoryblokPreview story={story}>
      {(live) => <StoryblokComponent block={live.content} />}
    </StoryblokPreview>
  );
}

export const getStaticProps: GetStaticProps<{ story: Story }> = async () => {
  const { data } = await client.stories.get("home", { query: { version: "draft" } });

  if (!data.story) return { notFound: true };

  return {
    props: { story: data.story },
    revalidate: 3600,
  };
};
