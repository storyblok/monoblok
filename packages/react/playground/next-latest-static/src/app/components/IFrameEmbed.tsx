import type { BlockContent } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";

interface UrlField {
  url?: string;
  title?: string;
}

const IFrameEmbed = ({ block }: { block: BlockContent & { url?: UrlField } }) => (
  <div {...storyblokEditable(block)} key={block._uid} data-test="iframe-embed">
    <div>
      <iframe src={block.url?.url} title={block.url?.title} />
    </div>
  </div>
);

export default IFrameEmbed;
