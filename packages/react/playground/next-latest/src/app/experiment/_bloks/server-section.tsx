// REAL — server blok used in the deep-alternation and context chains.
import type { SbBlokData } from '../_sdk/types';
import { serverBox, serverTag } from './styles';
import { storyblok } from './registry';

export function ServerSection({ blok }: { blok: SbBlokData }) {
  const body = Array.isArray(blok.body) ? (blok.body as SbBlokData[]) : [];
  return (
    <div style={serverBox}>
      <div style={serverTag}>[server-section] (server) — {String(blok.heading ?? '')}</div>
      <div style={{ marginTop: 8 }}>
        <storyblok.StoryblokBlocks blocks={body} />
      </div>
    </div>
  );
}
