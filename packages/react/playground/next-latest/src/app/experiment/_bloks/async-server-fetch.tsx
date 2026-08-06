// REAL — async server blok, mirrors Dipankar's `PostComponent` (jsonplaceholder).
//
// In this SDK rendering happens server-side: the recursive resolver awaits
// async components naturally during the RSC pass. In preview, the SDK takes
// a server-action + revalidatePath roundtrip, so this still runs on the
// server — fetch never leaves the server.
import type { BlokProps } from '../_sdk/types';
import { asyncBox, asyncTag } from './styles';

type Post = { userId: number; id: number; title: string; body: string };

export async function AsyncServerFetch({ blok }: BlokProps) {
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
