import React from 'react';
import type { SbBlokData } from '@storyblok/react';
import { storyblokEditable } from '@storyblok/react/ssr';

interface IframeEmbedProps {
  blok: SbBlokData & {
    url?: {
      url?: string;
      title?: string;
    };
  };
}

const IFrameEmbed = ({ blok }: IframeEmbedProps) => {
  const urlObject = blok?.url as { url?: string; title?: string } | undefined;

  return (
    <div {...storyblokEditable(blok)} key={blok._uid} data-test="iframe-embed">
      <div>
        <iframe src={urlObject?.url} title={urlObject?.title} />
      </div>
    </div>
  );
};

export default IFrameEmbed;
