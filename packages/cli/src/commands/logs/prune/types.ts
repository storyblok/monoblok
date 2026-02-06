import type { CommandOptions } from '../../../types';

export interface PruneLogsOptions extends CommandOptions {
  keep: number;
}
