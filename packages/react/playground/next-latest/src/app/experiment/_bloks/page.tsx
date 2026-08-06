// REAL — server blok. The story root; renders its nested body.
import type { BlokProps } from '../_sdk/types';

export function Page({ blok, children }: BlokProps) {
  return (
    <main>
      <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>{String(blok.title ?? '')}</h2>
      {children}
    </main>
  );
}
