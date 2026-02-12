import type { CommandOptions } from '../../../types';

export interface PruneReportsOptions extends CommandOptions {
  keep: number;
}
