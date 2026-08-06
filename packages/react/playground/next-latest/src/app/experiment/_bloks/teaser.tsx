'use client';

// REAL — client leaf blok rendered inside a server parent (client-in-server).
import type { BlokProps } from '../_sdk/types';
import { clientBox, clientTag } from './styles';

export function Teaser({ blok }: BlokProps) {
  return (
    <div style={clientBox}>
      <div style={clientTag}>[teaser] (client)</div>
      <strong style={{ color: '#111827' }}>{String(blok.headline ?? '')}</strong>
    </div>
  );
}
