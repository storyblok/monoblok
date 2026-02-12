import type { CommandOptions } from '../../../types';

export interface PushAssetsOptions extends CommandOptions {
  from?: string;
  data?: string;
  shortFilename?: string;
  folder?: string;
  cleanup?: boolean;
  updateStories?: boolean;
  assetToken?: string;
  dryRun?: boolean;
}
