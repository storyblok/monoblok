import type { StoryblokBlockComponentProps } from "@storyblok/react";

type IFrameEmbedProps = StoryblokBlockComponentProps<{
  url?: {
    url?: string;
    title?: string;
  };
}>;

const IFrameEmbed = ({ block, editable }: IFrameEmbedProps) => (
  <div {...editable} data-test="iframe-embed">
    <iframe src={block.url?.url} title={block.url?.title} />
  </div>
);

export default IFrameEmbed;
