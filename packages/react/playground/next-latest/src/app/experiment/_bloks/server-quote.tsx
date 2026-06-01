// REAL — server leaf blok. Reached from inside a client parent via the SDK
// registry (server-in-client scenario, the Dipankar way: client parent renders
// <StoryblokBlocks> which recursively resolves nested bloks).
//
// This blok is async and reads from a simulated server-only DB. In this SDK
// preview re-renders on the client, so this is the same hazard as
// `server-only-secret`: the client bundle cannot import `_stub/server-db`
// (its module-level guard throws). The renderer goes through the `use()` +
// Suspense path; on preview the fetch still has to happen somewhere with
// server access — exposing whether the SDK can keep the call server-side.
import type { SbBlokData } from '../_sdk/types';
import { getAuthorById } from '../_stub/server-db';
import { errorBox, errorTag, serverBox, serverTag } from './styles';

export async function ServerQuote({ blok }: { blok: SbBlokData }) {
  const authorId = String(blok.authorId ?? 'author-1');
  const author = await getAuthorById(authorId);
  const isServer = typeof window === 'undefined';
  const ok = Boolean(author);

  return (
    <div style={ok ? serverBox : errorBox}>
      <div style={ok ? serverTag : errorTag}>
        [server-quote] ({isServer ? 'server' : 'client'} render) — author={authorId}
      </div>
      <blockquote style={{ margin: '6px 0 0', color: '#111827', fontStyle: 'italic' }}>
        &ldquo;{String(blok.quote ?? '')}&rdquo;
      </blockquote>
      <div style={{ marginTop: 6, color: '#374151', fontSize: 12 }}>
        — {author ? `${author.name} <${author.email}>` : 'unknown'}
      </div>
    </div>
  );
}
