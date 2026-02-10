import type { CommandOptions } from '../../../types';

export interface PullStoriesOptions extends CommandOptions {
  dryRun?: boolean;
  query?: string;
  startsWith?: string;
}
