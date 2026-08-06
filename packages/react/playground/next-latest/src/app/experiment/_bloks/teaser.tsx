'use client';

// REAL — client leaf blok (client-in-server scenario). Local state proves
// the counter survives across edits when only the server tree above changes.
import { useState } from 'react';
import type { SbBlokData } from '../_sdk/types';
import { clientBox, clientTag } from './styles';

export function Teaser({ blok }: { blok: SbBlokData }) {
  const [count, setCount] = useState(0);
  return (
    <div style={clientBox}>
      <div style={clientTag}>[teaser] (client)</div>
      <strong style={{ color: '#111827' }}>{String(blok.headline ?? '')}</strong>
      <div style={{ marginTop: 6 }}>
        <button
          onClick={() => setCount((c) => c + 1)}
          style={{ padding: '4px 10px', cursor: 'pointer' }}
          data-testid="teaser-counter"
        >
          Counter {count}
        </button>
      </div>
    </div>
  );
}
