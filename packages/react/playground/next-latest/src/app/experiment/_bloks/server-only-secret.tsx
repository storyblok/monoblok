// REAL — blok that reads a server-only secret (a NON-NEXT_PUBLIC env var).
//
// In this SDK preview goes through a server action + revalidatePath, so the
// blok always renders on the server and the secret is available. Contrast
// with Dipankar's approach, where preview re-renders on the client and the
// value becomes `undefined`.
import type { BlokProps } from '../_sdk/types';
import { errorBox, errorTag, serverBox, serverTag } from './styles';

export function ServerOnlySecret(_props: BlokProps) {
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
