'use client';

// REAL — client blok that provides a context value, then recurses into a
// server subtree via StoryblokBlocks. A client descendant (theme-consumer)
// nested beneath the server blok should read the value.
import type { SbBlokData } from '../_sdk/types';
import { ThemeContext } from './theme-context';
import { contextBox, contextTag } from './styles';
import { storyblok } from './registry';

export function ThemeProvider({ blok }: { blok: SbBlokData }) {
  const theme = String(blok.theme ?? '');
  const body = Array.isArray(blok.body) ? (blok.body as SbBlokData[]) : [];
  return (
    <ThemeContext.Provider value={theme}>
      <div style={contextBox}>
        <div style={contextTag}>[theme-provider] (client) — provides theme &ldquo;{theme}&rdquo;</div>
        <div style={{ marginTop: 8 }}>
          <storyblok.StoryblokBlocks blocks={body} />
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
