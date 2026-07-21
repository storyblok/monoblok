// REAL — server blok. Hosts mixed (server + client) children via StoryblokBlocks.
import type { SbBlokData } from '../_sdk/types';
import { serverBox, serverTag } from './styles';
import { storyblok } from './registry';

export function Grid({ blok }: { blok: SbBlokData }) {
  const body = Array.isArray(blok.body) ? (blok.body as SbBlokData[]) : [];
  return (
    <div style={serverBox}>
      <div style={serverTag}>[grid] (server)</div>
      <h3 style={{ margin: '6px 0', color: '#111827' }}>{String(blok.heading ?? '')}</h3>
      <div style={{ display: 'grid', gap: 8 }}>
        <storyblok.StoryblokBlocks blocks={body} />
      </div>
    </div>
  );
}
