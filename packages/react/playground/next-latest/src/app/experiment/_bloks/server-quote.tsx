// REAL — server leaf blok. Commonly passed as `children` into a client blok
// (the legal server-in-client direction).
//
// This blok is async and reads from a simulated server-only DB. Because this
// SDK does preview via a server action + revalidatePath, the blok always
// renders on the server — even in preview — so the DB call stays server-side
// and the module's `typeof window` guard is never tripped.
import type { BlokProps } from '../_sdk/types';
import { getAuthorById } from '../_stub/server-db';
import { errorBox, errorTag, serverBox, serverTag } from './styles';

export async function ServerQuote({ blok }: BlokProps) {
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
        “{String(blok.quote ?? '')}”
      </blockquote>
      <div style={{ marginTop: 6, color: '#374151', fontSize: 12 }}>
        — {author ? `${author.name} <${author.email}>` : 'unknown'}
      </div>
    </div>
  );
}
