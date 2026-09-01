import type { StoriesQueryParams, Story } from "../constants";
import type { UI } from "../../../lib/ui";
import type { Logger } from "../../../lib/logger/logger";
import type { Reporter } from "../../../lib/reporter/reporter";
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

/** The modules and space scope every mode of the command runs against. */
export type FindContext = {
  spaceId: string;
  params: StoriesQueryParams;
  ui: UI;
  logger: Logger;
  reporter: Reporter;
  verbose: boolean;
};
