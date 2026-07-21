// REAL — the registry the app passes to the SDK: component name -> component.
// Mixes server and client modules freely (client imports resolve to references).
import type { ComponentsMap } from '../_sdk/types';
import { Page } from './page';
import { Grid } from './grid';
import { Feature } from './feature';
import { ServerQuote } from './server-quote';
import { ServerSection } from './server-section';
import { Teaser } from './teaser';
import { ClientCard } from './client-card';
import { ClientPanel } from './client-panel';
import { ClientLeaf } from './client-leaf';
import { ThemeProvider } from './theme-provider';
import { ThemeConsumer } from './theme-consumer';
import { AsyncServerFetch } from './async-server-fetch';
import { ServerOnlySecret } from './server-only-secret';

export const components: ComponentsMap = {
  'page': Page,
  'grid': Grid,
  'feature': Feature,
  'server-quote': ServerQuote,
  'server-section': ServerSection,
  'teaser': Teaser,
  'client-card': ClientCard,
  'client-panel': ClientPanel,
  'client-leaf': ClientLeaf,
  'theme-provider': ThemeProvider,
  'theme-consumer': ThemeConsumer,
  'async-server-fetch': AsyncServerFetch,
  'server-only-secret': ServerOnlySecret,
};
