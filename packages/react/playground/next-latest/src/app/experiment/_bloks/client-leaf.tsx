'use client';

// REAL — client leaf at the bottom of the deep-alternation chain. The local
// `note` input proves nested client state survives the RSC payload swap.
import { useState } from 'react';
import type { BlokProps } from '../_sdk/types';
import { clientBox, clientTag } from './styles';

export function ClientLeaf({ blok }: BlokProps) {
  const [note, setNote] = useState('');

  return (
    <div style={clientBox}>
      <div style={clientTag}>[client-leaf] (client) — {String(blok.label ?? '')}</div>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="local state (should survive edits)"
        style={{
          marginTop: 6,
          width: '100%',
          boxSizing: 'border-box',
          padding: '4px 8px',
          color: '#111827',
          border: '1px solid #9ca3af',
          borderRadius: 4,
        }}
        data-testid="leaf-note"
      />
    </div>
  );
}
