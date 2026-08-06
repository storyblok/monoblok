'use client';

// REAL — client blok that recursively renders nested bloks (which may be
// server bloks) via the SDK registry. In Dipankar's design this is how
// "server-in-client" works: the client component invokes StoryblokBlocks,
// which through the registry resolves each child. Local `open` state proves
// client state survives live-preview re-renders.
import { useState } from 'react';
import type { SbBlokData } from '../_sdk/types';
import { clientBox, clientTag } from './styles';
import { storyblok } from './registry';

export function ClientCard({ blok }: { blok: SbBlokData }) {
  const [open, setOpen] = useState(true);
  const body = Array.isArray(blok.body) ? (blok.body as SbBlokData[]) : [];

  return (
    <div style={clientBox}>
      <div style={clientTag}>[client-card] (client, hosts nested via StoryblokBlocks)</div>
      <strong style={{ color: '#111827' }}>{String(blok.title ?? '')}</strong>
      <div style={{ marginTop: 6 }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{ padding: '4px 10px', cursor: 'pointer' }}
          data-testid="card-toggle"
        >
          {open ? 'Collapse' : 'Expand'}
        </button>
      </div>
      {open && (
        <div style={{ marginTop: 8 }}>
          <storyblok.StoryblokBlocks blocks={body} />
        </div>
      )}
    </div>
  );
}
