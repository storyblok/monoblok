'use client';

// REAL — client blok that hosts a pre-rendered SERVER blok as `children`
// (server-in-client). The local `open` state proves client state survives the
// RSC payload swap on each live-preview edit.
import { useState } from 'react';
import type { BlokProps } from '../_sdk/types';
import { clientBox, clientTag } from './styles';

export function ClientCard({ blok, children }: BlokProps) {
  const [open, setOpen] = useState(true);

  return (
    <div style={clientBox}>
      <div style={clientTag}>[client-card] (client, hosts server children)</div>
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
      {open && <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  );
}
