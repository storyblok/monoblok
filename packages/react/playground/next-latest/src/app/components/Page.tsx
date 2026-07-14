import type { SbBlokData } from '@storyblok/react';
import { storyblokEditable, StoryblokServerComponent } from '@storyblok/react/rsc';

interface PageBlok extends SbBlokData {
  body: SbBlokData[];
}

const Page = ({ blok }: { blok: PageBlok }) => (
  <main {...storyblokEditable(blok)}>
    {blok.body.map(nestedBlok => (
      <StoryblokServerComponent blok={nestedBlok} key={nestedBlok._uid} />
    ))}
  </main>
);

export default Page;
