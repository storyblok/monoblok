// REAL — server blok. Hosts mixed (server + client) children.
import type { BlokProps } from '../_sdk/types';
import { serverBox, serverTag } from './styles';

export function Grid({ blok, children }: BlokProps) {
  return (
    <div style={serverBox}>
      <div style={serverTag}>[grid] (server)</div>
      <h3 style={{ margin: '6px 0', color: '#111827' }}>{String(blok.heading ?? '')}</h3>
      <div style={{ display: 'grid', gap: 8 }}>{children}</div>
    </div>
  );
}
