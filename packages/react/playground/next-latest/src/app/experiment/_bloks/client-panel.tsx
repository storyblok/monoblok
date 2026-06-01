'use client';

// REAL — client blok in the deep-alternation chain
// (server-section > client-panel > server-section > client-leaf). Renders the
// pre-rendered server children it receives.
import type { BlokProps } from '../_sdk/types';
import { clientBox, clientTag } from './styles';

export function ClientPanel({ blok, children }: BlokProps) {
  return (
    <div style={clientBox}>
      <div style={clientTag}>[client-panel] (client) — {String(blok.label ?? '')}</div>
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  );
}
