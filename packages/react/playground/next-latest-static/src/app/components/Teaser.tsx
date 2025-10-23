import { storyblokEditable } from '@storyblok/react/ssr';
import type { SbBlokData } from '@storyblok/react';
// import { headers } from 'next/headers';

interface TeaserProps {
  blok: SbBlokData & {
    headline?: string;
  };
}

const Teaser = ({ blok }: TeaserProps) => {
  // headers()
  return (
    <h2 data-cy="teaser" {...storyblokEditable(blok)}>
      {blok.headline}
    </h2>
  );
};

export default Teaser;
