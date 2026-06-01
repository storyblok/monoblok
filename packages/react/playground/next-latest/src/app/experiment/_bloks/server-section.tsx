// REAL — server blok. A labelled container used in the deep-alternation and
// context chains; renders its nested body.
import type { BlokProps } from '../_sdk/types';
import { serverBox, serverTag } from './styles';

export function ServerSection({ blok, children }: BlokProps) {
  return (
    <div style={serverBox}>
      <div style={serverTag}>[server-section] (server) — {String(blok.heading ?? '')}</div>
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  );
}
