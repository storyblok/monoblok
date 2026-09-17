import type { StoryblokComponentProps } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";

type IFrameEmbedProps = StoryblokComponentProps<{
  url?: {
    url?: string;
    title?: string;
  };
}>;

const IFrameEmbed = ({ block }: IFrameEmbedProps) => (
  <div {...storyblokEditable(block)} data-test="iframe-embed">
    <iframe src={block.url?.url} title={block.url?.title} />
  </div>
);

export default IFrameEmbed;
