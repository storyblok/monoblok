// REAL — server leaf blok.
import type { SbBlokData } from '../_sdk/types';
import { serverBox, serverTag } from './styles';

export function Feature({ blok }: { blok: SbBlokData }) {
  return (
    <div style={serverBox}>
      <div style={serverTag}>[feature] (server)</div>
      <strong style={{ color: '#111827' }}>{String(blok.name ?? '')}</strong>
      <p style={{ margin: '4px 0 0', color: '#374151' }}>{String(blok.text ?? '')}</p>
    </div>
  );
}
