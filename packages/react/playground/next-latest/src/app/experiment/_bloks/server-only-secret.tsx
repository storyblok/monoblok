// REAL — blok that reads a server-only secret (a NON-NEXT_PUBLIC env var).
//
// On the server: `process.env.SERVER_ONLY_SECRET` resolves to whatever the
// server has configured (set in `.env.local`, never exposed to the client).
//
// On the client (live-preview re-renders): without `NEXT_PUBLIC_` prefix,
// Next.js does not inline this for the browser. The value will be `undefined`.
// This blok is the canonical example of what server-only access *loses* when
// preview re-renders the tree client-side.
import type { SbBlokData } from '../_sdk/types';
import { errorBox, errorTag, serverBox, serverTag } from './styles';

export function ServerOnlySecret(_props: { blok: SbBlokData }) {
  const secret = process.env.SERVER_ONLY_SECRET;
  const isServer = typeof window === 'undefined';
  const ok = Boolean(secret);

  return (
    <div style={ok ? serverBox : errorBox}>
      <div style={ok ? serverTag : errorTag}>
        [server-only-secret] ({isServer ? 'server' : 'client'} render) —{' '}
        {ok ? 'secret available ✅' : 'secret undefined ❌'}
      </div>
      <div style={{ marginTop: 6, color: '#111827', fontFamily: 'monospace', fontSize: 12 }}>
        process.env.SERVER_ONLY_SECRET = {JSON.stringify(secret ?? null)}
      </div>
    </div>
  );
}
