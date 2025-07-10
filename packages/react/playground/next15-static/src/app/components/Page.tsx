import { storyblokEditable, StoryblokServerComponent } from '@storyblok/react/ssr';
import type { SbBlokData } from '@storyblok/react';

interface PageProps {
  blok: SbBlokData & {
    body: SbBlokData[];
  };
}

const Page = ({ blok }: PageProps) => (
  <main {...storyblokEditable(blok)}>
    {blok.body.map(nestedBlok => (
      // @ts-ignore - React 19 type compatibility issue
      <StoryblokServerComponent blok={nestedBlok} key={nestedBlok._uid} />
    ))}
  </main>
);

export default Page;
