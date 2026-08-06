// REAL — server blok. The story root; recurses via StoryblokBlocks.
// Key adaptation from spike: no `children` prop magic. Each parent blok
// explicitly renders its nested body through the SDK's StoryblokBlocks.
import type { SbBlokData } from '../_sdk/types';
import { storyblok } from './registry';

export function Page({ blok }: { blok: SbBlokData }) {
  const body = Array.isArray(blok.body) ? (blok.body as SbBlokData[]) : [];
  return (
    <main>
      <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>{String(blok.title ?? '')}</h2>
      <storyblok.StoryblokBlocks blocks={body} />
    </main>
  );
}
