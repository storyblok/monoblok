// STUB — simulated server-only DB. Module-level guard throws if this file
// ever ends up in a client bundle (mimics what `server-only` would enforce
// at build time). Async + artificial latency to mimic a real query.
if (typeof window !== 'undefined') {
  throw new Error('[server-db] imported on the client — server-only module');
}

type Author = { id: string; name: string; email: string };

const authors: Record<string, Author> = {
  'author-1': { id: 'author-1', name: 'Ada Lovelace', email: 'ada@example.com' },
  'author-2': { id: 'author-2', name: 'Alan Turing', email: 'alan@example.com' },
};

export async function getAuthorById(id: string): Promise<Author | null> {
  await new Promise((r) => setTimeout(r, 50));
  return authors[id] ?? null;
}
