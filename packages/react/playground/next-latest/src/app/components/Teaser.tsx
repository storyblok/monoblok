import type { SbBlokData } from '@storyblok/react';
import { storyblokEditable } from '@storyblok/react/rsc';

interface TeaserBlok extends SbBlokData {
  headline: string;
}

const Teaser = ({ blok }: { blok: TeaserBlok }) => {
  return (
    <h2 data-cy="teaser" {...storyblokEditable(blok)}>
      {blok.headline}
    </h2>
  );
};

export default Teaser;
