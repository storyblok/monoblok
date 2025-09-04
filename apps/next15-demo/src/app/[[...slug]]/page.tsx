import React from "react";
import { SWRProvider } from "../components/SWRProvider";
import { BridgeHandler } from "../components/BridgeHandler";
import { client } from "@/lib/client";
import { Story } from "../Story";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { getStory } from "@/lib/getStory";

export default async function Page({ params }: { params: { slug: string } }) {
  let { slug } = await params;

  if (slug == null) {
    slug = "home";
  }

  if (Array.isArray(slug)) {
    slug = slug.join("/");
  }

  const { story, header } = await fetchPage(slug);

  return (
    <SWRProvider
      fallback={{
        [`cdn/stories/${slug}`]: story,
        "cdn/stories/site-config": header,
      }}
    >
      <Header />
      <Story slug={slug} />
      <Footer />
      <BridgeHandler />
    </SWRProvider>
  );
}

const fetchPage = async (slug: string) => {
  const storyReq = getStory(slug);

  const headerReq = client.get("cdn/stories/site-config", {
    version: "draft",
    resolve_links: "url",
    from_release: "0",
  });

  const [story, header] = await Promise.all([storyReq, headerReq]);

  return { story: story.data.story, header: header.data.story };
};
