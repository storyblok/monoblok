// REAL — server leaf blok. Commonly passed as `children` into a client blok
// (the legal server-in-client direction).
import type { BlokProps } from '../_sdk/types';
import { serverBox, serverTag } from './styles';

export function ServerQuote({ blok }: BlokProps) {
  return (
    <div style={serverBox}>
      <div style={serverTag}>[server-quote] (server)</div>
      <blockquote style={{ margin: '6px 0 0', color: '#111827', fontStyle: 'italic' }}>
        “{String(blok.quote ?? '')}”
      </blockquote>
    </div>
  );
}
