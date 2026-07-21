'use client';

// REAL — client blok in the deep-alternation chain
// (server-section > client-panel > server-section > client-leaf).
import type { SbBlokData } from '../_sdk/types';
import { clientBox, clientTag } from './styles';
import { storyblok } from './registry';

export function ClientPanel({ blok }: { blok: SbBlokData }) {
  const body = Array.isArray(blok.body) ? (blok.body as SbBlokData[]) : [];
  return (
    <div style={clientBox}>
      <div style={clientTag}>[client-panel] (client) — {String(blok.label ?? '')}</div>
      <div style={{ marginTop: 8 }}>
        <storyblok.StoryblokBlocks blocks={body} />
      </div>
    </div>
  );
}
