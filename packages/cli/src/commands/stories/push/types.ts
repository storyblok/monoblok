import type { CommandOptions } from '../../../types';

export interface PushStoriesOptions extends CommandOptions {
  from?: string;
  dryRun?: boolean;
  publish?: string;
  cleanup?: boolean;
}
