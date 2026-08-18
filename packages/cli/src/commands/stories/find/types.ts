import type { Story } from "../constants";
import type { PublishStatus } from "./filters";

export type EntryType = "all" | "story" | "folder";

export interface FindOptions {
  space?: string;
  searchMode?: string;
  entryType?: EntryType;
  startsWith?: string;
  containerBlock?: string;
  includesBlock?: string;
  query?: string;
  where?: string[];
  publishStatus?: PublishStatus;
  references?: string;
  checkReferences?: boolean;
  skipContent?: boolean;
  capiFilter?: boolean;
  capiParams?: string;
}

export type ClientFilter = (story: Story) => boolean;
