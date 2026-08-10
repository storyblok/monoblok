import type { Story } from '../constants';
import type { PublishStatus, TranslationStatus } from './filters';

export type EntryType = 'all' | 'story' | 'folder';

export interface FindOptions {
  space?: string;
  searchMode?: string;
  entryType?: EntryType;
  startsWith?: string;
  rootBlock?: string;
  containsBlock?: string;
  query?: string;
  where?: string[];
  publishStatus?: PublishStatus;
  translationStatus?: TranslationStatus;
  language?: string;
}

export type ClientFilter = (story: Story) => boolean;
