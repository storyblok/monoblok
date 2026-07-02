// REAL — composition root. App imports all bloks, creates the renderer, and
// exports { StoryblokComponent, StoryblokBlocks } for both the route and the
// individual bloks (which recurse via StoryblokBlocks).
//
// Mirrors Dipankar's `lib/storyblok.ts` pattern. Circular import with bloks
// is fine because bloks only access `storyblok` at render time, not module init.
import { createStoryblokRenderer } from '../_sdk/create-storyblok-renderer';
import type { ResolverConfig } from '../_sdk/create-resolver';
import { Page } from './page';
import { Grid } from './grid';
import { Feature } from './feature';
import { Teaser } from './teaser';
import { ServerQuote } from './server-quote';
import { ServerSection } from './server-section';
import { ClientCard } from './client-card';
import { ClientPanel } from './client-panel';
import { ClientLeaf } from './client-leaf';
import { ThemeProvider } from './theme-provider';
import { ThemeConsumer } from './theme-consumer';
import { AsyncServerFetch } from './async-server-fetch';
import { ServerOnlySecret } from './server-only-secret';
import { Fallback } from './fallback';
import { SuspenseFallback } from './suspense-fallback';

const resolverConfig: ResolverConfig = {
  fallback: Fallback,
  suspenseFallback: SuspenseFallback,
  warnMissingComponents: true,
  cacheKeys: {
    'async-server-fetch': (blok) => `${blok._uid}-${String(blok.postId ?? '')}`,
  },
};

export const storyblok = createStoryblokRenderer(
  {
    'page': Page,
    'grid': Grid,
    'feature': Feature,
    'teaser': Teaser,
    'server-quote': ServerQuote,
    'server-section': ServerSection,
    'client-card': ClientCard,
    'client-panel': ClientPanel,
    'client-leaf': ClientLeaf,
    'theme-provider': ThemeProvider,
    'theme-consumer': ThemeConsumer,
    'async-server-fetch': AsyncServerFetch,
    'server-only-secret': ServerOnlySecret,
  },
  resolverConfig,
);
