import type { Story } from '../constants';
import type { PublishStatus } from './filters';

export type EntryType = 'all' | 'story' | 'folder';

export interface FindOptions {
  space?: string;
  searchMode?: string;
  entryType?: EntryType;
  startsWith?: string;
  containerBlock?: string;
  containsBlock?: string;
  query?: string;
  where?: string[];
  publishStatus?: PublishStatus;
}

export type ClientFilter = (story: Story) => boolean;
