import type { StoryblokBlockComponentProps } from "@storyblok/react";

type IframeEmbedProps = StoryblokBlockComponentProps<{ url?: { url?: string; title?: string } }>;

const IFrameEmbed = ({ block, editable }: IframeEmbedProps) => {
  return (
    <div {...editable} key={block._uid} data-test="iframe-embed">
      <div>
        <iframe src={block?.url?.url} title={block?.url?.title} />
      </div>
    </div>
  );
};

export default IFrameEmbed;
