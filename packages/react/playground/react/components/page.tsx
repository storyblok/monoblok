import React from 'react';
import type {
  SbBlokData,
  SbRichTextDoc,
} from '@storyblok/react';
import {
  StoryblokComponent,
  storyblokEditable,
  StoryblokRichText,
} from '@storyblok/react';

interface PageProps {
  blok: SbBlokData;
}

const Page = ({ blok }: PageProps) => {
  const richText = blok.richText as SbRichTextDoc;
  return (
  <div {...storyblokEditable(blok)} key={blok._uid} data-test="page">
    {blok.body
      ? (blok.body as SbBlokData[]).map(nestedBlok => (
          <div key={nestedBlok._uid}>
            <StoryblokComponent blok={nestedBlok} />
          </div>
        ))
      : null}
    {richText ? <StoryblokRichText document={richText} /> : null}
  </div>
)};

export default Page;
