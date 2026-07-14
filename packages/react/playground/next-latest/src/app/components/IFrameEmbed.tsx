import React from 'react';
import type { SbBlokData } from '@storyblok/react';
import { storyblokEditable } from '@storyblok/react/rsc';

interface IframeEmbedBlok extends SbBlokData {
  url?: { url?: string; title?: string };
}

interface IframeEmbedProps {
  blok: IframeEmbedBlok;
}

const IFrameEmbed = ({ blok }: IframeEmbedProps) => {
  return (
    <div {...storyblokEditable(blok)} key={blok._uid} data-test="iframe-embed">
      <div>
        <iframe src={blok?.url?.url} title={blok?.url?.title} />
      </div>
    </div>
  );
};

export default IFrameEmbed;
