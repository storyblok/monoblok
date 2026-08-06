'use client';

// REAL — client blok that provides a context value derived from its blok, then
// renders a server subtree as children. A client descendant (theme-consumer)
// nested beneath the intervening server blok reads the value, proving client
// context propagates through server components and updates on each edit.
import type { BlokProps } from '../_sdk/types';
import { ThemeContext } from './theme-context';
import { contextBox, contextTag } from './styles';

export function ThemeProvider({ blok, children }: BlokProps) {
  const theme = String(blok.theme ?? '');

  return (
    <ThemeContext.Provider value={theme}>
      <div style={contextBox}>
        <div style={contextTag}>[theme-provider] (client) — provides theme &quot;{theme}&quot;</div>
        <div style={{ marginTop: 8 }}>{children}</div>
      </div>
    </ThemeContext.Provider>
  );
}
