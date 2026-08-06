// REAL — async blok, mirrors Dipankar's `PostComponent` (jsonplaceholder).
//
// On the server (production route or initial preview render): runs as a true
// async server component, fetched on the server.
//
// On the client (live-preview re-renders): Dipankar's renderer detects the
// returned Promise and wraps it with <Suspense> + React 19's `use()` via
// the per-component cache. Fetch happens in the browser. This is the key
// "preview preserves async data" claim — verify it here.
import type { SbBlokData } from '../_sdk/types';
import { asyncBox, asyncTag } from './styles';

type Post = { userId: number; id: number; title: string; body: string };

export async function AsyncServerFetch({ blok }: { blok: SbBlokData }) {
  const postId = blok.postId ?? 1;
  const res = await fetch(`https://jsonplaceholder.typicode.com/posts/${String(postId)}`, {
    cache: 'no-store',
  });
  const post: Post = await res.json();
  return (
    <div style={asyncBox}>
      <div style={asyncTag}>
        [async-server-fetch] (async) — postId={String(postId)}
      </div>
      <h4 style={{ margin: '6px 0 4px', color: '#111827' }}>{post.title}</h4>
      <p style={{ margin: 0, color: '#374151', fontSize: 14 }}>{post.body}</p>
    </div>
  );
}
