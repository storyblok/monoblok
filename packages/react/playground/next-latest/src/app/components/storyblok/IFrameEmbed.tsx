import type { StoryblokComponentProps } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";

type IframeEmbedProps = StoryblokComponentProps<{ url?: { url?: string; title?: string } }>;

const IFrameEmbed = ({ block }: IframeEmbedProps) => {
  return (
    <div {...storyblokEditable(block)} key={block._uid} data-test="iframe-embed">
      <div>
        <iframe src={block?.url?.url} title={block?.url?.title} />
      </div>
    </div>
  );
};

export default IFrameEmbed;
