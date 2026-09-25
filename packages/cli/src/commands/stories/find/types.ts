import type { StoriesQueryParams, Story } from "../constants";
import type { UI } from "../../../lib/ui";
import type { Logger } from "../../../lib/logger/logger";
import type { Reporter } from "../../../lib/reporter/reporter";
import type { PublishStatus } from "./filters";

export type EntryType = "all" | "story" | "folder";

export interface FindOptions {
  space?: string;
  entryType?: EntryType;
  startsWith?: string;
  containerBlock?: string;
  includesBlock?: string;
  query?: string;
  where?: string[];
  tag?: string;
  workflowStage?: string;
  publishStatus?: PublishStatus;
  sort?: string;
  limit?: string;
  references?: string;
  /** `true` for the bare flag, or a comma-separated list of issue types. */
  checkReferences?: boolean | string;
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
