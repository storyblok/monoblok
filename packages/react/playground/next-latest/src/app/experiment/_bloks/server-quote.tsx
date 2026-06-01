// REAL — server leaf blok. Reached from inside a client parent via the SDK
// registry (server-in-client scenario, the Dipankar way: client parent renders
// <StoryblokBlocks> which recursively resolves nested bloks).
import type { SbBlokData } from '../_sdk/types';
import { serverBox, serverTag } from './styles';

export function ServerQuote({ blok }: { blok: SbBlokData }) {
  return (
    <div style={serverBox}>
      <div style={serverTag}>[server-quote] (server)</div>
      <blockquote style={{ margin: '6px 0 0', color: '#111827', fontStyle: 'italic' }}>
        &ldquo;{String(blok.quote ?? '')}&rdquo;
      </blockquote>
    </div>
  );
}
