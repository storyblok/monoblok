import type { CommandOptions } from '../../../types';

export interface PullAssetsOptions extends CommandOptions {
  dryRun?: boolean;
  query?: string;
  assetToken?: string;
}
